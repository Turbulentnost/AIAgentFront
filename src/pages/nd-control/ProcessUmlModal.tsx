import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import mermaid from "mermaid";
import { AlertTriangle, Copy, Download, Loader2, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { ndControlApi } from "@/api/endpoints";
import { sanitizeMermaidCode } from "@/utils/sanitizeMermaid";
import type { DepartmentProcessItem } from "@/types";
import styles from "../NdControlAgent.module.css";

type Props = {
  process: DepartmentProcessItem;
  onClose: () => void;
};

let mermaidInitialized = false;

function ensureMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    flowchart: { useMaxWidth: false, htmlLabels: true }
  });
  mermaidInitialized = true;
}

function extractErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (error instanceof Error && error.message) return error.message;
  return "Не удалось построить диаграмму процесса";
}

async function svgToPng(svg: string, fileName: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось преобразовать SVG"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = Math.max(image.width, 800) * scale;
    canvas.height = Math.max(image.height, 600) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `${fileName}.png`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ProcessUmlModal({ process, onClose }: Props) {
  const renderId = useId().replace(/:/g, "");
  const viewportRef = useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const umlQuery = useQuery({
    queryKey: ["nd-control", "process-uml", process.process_id, refreshKey],
    queryFn: () => ndControlApi.getProcessUml(process.process_id, { force: refreshKey > 0 }),
    retry: false
  });

  const umlCode = umlQuery.data?.uml_code ? sanitizeMermaidCode(umlQuery.data.uml_code) : null;
  const processTitle = umlQuery.data?.process_name ?? process.name;

  useEffect(() => {
    if (!umlCode) {
      setSvgMarkup(null);
      setRenderError(null);
      return;
    }
    let cancelled = false;
    ensureMermaid();
    setRenderError(null);
    mermaid
      .render(`uml-${renderId}-${Date.now()}`, umlCode)
      .then(({ svg }) => {
        if (!cancelled) setSvgMarkup(svg);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setSvgMarkup(null);
          setRenderError(error.message || "Ошибка рендера Mermaid");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [umlCode, renderId]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((value) => Math.min(2.5, Math.max(0.4, Number((value + delta).toFixed(2)))));
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!viewportRef.current) return;
      setIsPanning(true);
      panStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      viewportRef.current.setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isPanning) return;
      setPan({
        x: panStart.current.panX + (event.clientX - panStart.current.x),
        y: panStart.current.panY + (event.clientY - panStart.current.y)
      });
    },
    [isPanning]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    setIsPanning(false);
    viewportRef.current?.releasePointerCapture(event.pointerId);
  }, []);

  const handleCopy = async () => {
    if (!umlCode) return;
    await navigator.clipboard.writeText(umlCode);
    setCopyDone(true);
    window.setTimeout(() => setCopyDone(false), 2000);
  };

  const handleDownload = async () => {
    if (!svgMarkup) return;
    const safeName = processTitle.replace(/[^\wа-яА-ЯёЁ\s-]+/gi, "").trim() || "process-uml";
    await svgToPng(svgMarkup, safeName);
  };

  const isLoading = umlQuery.isLoading || umlQuery.isFetching;
  const apiError = umlQuery.isError ? extractErrorMessage(umlQuery.error) : null;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.umlModalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2>{processTitle}</h2>
            {umlQuery.data?.cached ? <p className={styles.umlModalMeta}>Из кеша</p> : null}
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className={styles.umlLoadingState}>
            <Loader2 size={36} className={styles.spinIcon} aria-hidden />
            <p>Генерация диаграммы процесса…</p>
            <small>Анализ связей, формирование графа</small>
          </div>
        ) : apiError ? (
          <div className={styles.umlErrorState}>
            <AlertTriangle size={28} />
            <p>Не удалось построить диаграмму процесса</p>
            <small>Причина: {apiError}</small>
          </div>
        ) : renderError ? (
          <div className={styles.umlErrorState}>
            <AlertTriangle size={28} />
            <p>Не удалось отобразить диаграмму</p>
            <small>{renderError}</small>
          </div>
        ) : (
          <>
            <div className={styles.umlToolbar}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setZoom((v) => Math.max(0.4, v - 0.1))}>
                <ZoomOut size={16} /> Уменьшить
              </button>
              <span className={styles.umlZoomLabel}>{Math.round(zoom * 100)}%</span>
              <button type="button" className={styles.secondaryBtn} onClick={() => setZoom((v) => Math.min(2.5, v + 0.1))}>
                <ZoomIn size={16} /> Увеличить
              </button>
            </div>
            <div
              ref={viewportRef}
              className={styles.umlViewport}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <div
                className={styles.umlCanvas}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                dangerouslySetInnerHTML={svgMarkup ? { __html: svgMarkup } : undefined}
              />
            </div>
          </>
        )}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryBtn} disabled={!umlCode} onClick={handleCopy}>
            <Copy size={16} />
            {copyDone ? "Скопировано" : "Скопировать Mermaid код"}
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={!svgMarkup} onClick={handleDownload}>
            <Download size={16} />
            Скачать PNG
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={isLoading}
            onClick={() => {
              setRefreshKey((value) => value + 1);
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <RefreshCw size={16} />
            Пересоздать диаграмму
          </button>
          <button type="button" className={styles.primaryBtn} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
