import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { browserRunnerClient } from "./browserRunnerClient";
import { extractPageContent } from "./extractPageContent";
import type { BrowserRun, BrowserRunResult, ExtractedPageContent } from "./types";

const POLL_INTERVAL_MS = 3000;

export function BrowserRunnerProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) return;

    let disposed = false;
    const poll = async () => {
      try {
        const runs = await browserRunnerClient.pending();
        if (disposed) return;
        runs.forEach((run) => {
          if (inFlight.current.has(run.id)) return;
          inFlight.current.add(run.id);
          executeRun(run)
            .catch((error) => submitFailure(run, error))
            .finally(() => inFlight.current.delete(run.id));
        });
      } catch (error) {
        console.warn("Не удалось получить browser-run задания", error);
      }
    };

    void poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}

async function executeRun(run: BrowserRun) {
  const content = await openViaIframe(run).catch(() => openViaPopup(run));
  await browserRunnerClient.submitResult(run.id, toResult(run, content));
}

function openViaIframe(run: BrowserRun): Promise<ExtractedPageContent> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    const timeout = window.setTimeout(() => {
      iframe.remove();
      reject(new Error("iframe_timeout"));
    }, Math.min(run.timeout_seconds * 1000, 15000));

    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.onload = () => {
      try {
        const frameDocument = iframe.contentDocument;
        if (!frameDocument) throw new Error("iframe_document_unavailable");
        const content = extractPageContent(frameDocument, run.extract_mode);
        window.clearTimeout(timeout);
        iframe.remove();
        resolve(content);
      } catch (error) {
        window.clearTimeout(timeout);
        iframe.remove();
        reject(error);
      }
    };
    iframe.onerror = () => {
      window.clearTimeout(timeout);
      iframe.remove();
      reject(new Error("iframe_load_failed"));
    };
    iframe.src = run.url;
    document.body.appendChild(iframe);
  });
}

function openViaPopup(run: BrowserRun): Promise<ExtractedPageContent> {
  const reason = typeof run.metadata?.reason === "string" ? run.metadata.reason : "агенту нужна информация со страницы";
  const allowed = window.confirm(`ИИ-агент запросил страницу:\n${run.url}\n\nПричина: ${reason}\n\nОткрыть страницу?`);
  if (!allowed) return Promise.reject(new Error("Пользователь отменил открытие страницы"));

  const popup = window.open(run.url, `_browser_run_${run.id}`, "width=1200,height=900");
  if (!popup) return Promise.reject(new Error("Браузер заблокировал popup для browser-runner"));

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timeoutMs = Math.min(run.timeout_seconds * 1000, 60000);
    const timer = window.setInterval(() => {
      try {
        if (popup.closed) {
          window.clearInterval(timer);
          reject(new Error("Окно browser-runner было закрыто до извлечения данных"));
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          window.clearInterval(timer);
          popup.close();
          reject(new Error("Истекло время ожидания загрузки popup"));
          return;
        }
        const popupDocument = popup.document;
        if (!popupDocument || popupDocument.readyState !== "complete") return;
        const content = extractPageContent(popupDocument, run.extract_mode);
        window.clearInterval(timer);
        popup.close();
        resolve(content);
      } catch (error) {
        window.clearInterval(timer);
        popup.close();
        reject(
          new Error(
            `Браузер запретил чтение содержимого страницы. Проверьте CORS/X-Frame-Options или используйте разрешенный same-origin источник. ${String(error)}`
          )
        );
      }
    }, 500);
  });
}

function toResult(run: BrowserRun, content: ExtractedPageContent): BrowserRunResult {
  return {
    status: "completed",
    title: content.title,
    text: content.text,
    html: content.html,
    tables: content.tables,
    metadata: {
      ...content.metadata,
      browser_runner_mode: "iframe_or_popup",
      screenshot_supported: run.extract_mode !== "screenshot" ? undefined : false
    }
  };
}

async function submitFailure(run: BrowserRun, error: unknown) {
  await browserRunnerClient.submitResult(run.id, {
    status: "failed",
    error_message: error instanceof Error ? error.message : String(error),
    metadata: { failed_at: new Date().toISOString() }
  });
}
