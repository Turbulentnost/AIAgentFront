import mermaid from "mermaid";
import { repairMermaidCode, sanitizeMermaidCode } from "@/utils/sanitizeMermaid";

let mermaidConfigured = false;

export function ensureMermaidConfigured() {
  if (mermaidConfigured) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    suppressErrorRendering: true,
    flowchart: { useMaxWidth: false, htmlLabels: true }
  });
  mermaidConfigured = true;
}

/** Удалить артефакты Mermaid (в т.ч. «Syntax error»), оставшиеся в body после неудачного render. */
export function cleanupMermaidDomArtifacts() {
  document.querySelectorAll("body > div").forEach((node) => {
    if (node.querySelector(".error-icon, .error-text")) {
      node.remove();
    }
  });
  document.querySelectorAll('[id^="uml-"], [id^="dgraph-uml-"]').forEach((node) => {
    node.remove();
  });
}

async function tryParse(code: string): Promise<boolean> {
  const parsed = await mermaid.parse(code, { suppressErrors: true });
  return Boolean(parsed);
}

async function tryRender(
  code: string,
  renderId: string
): Promise<{ svg: string } | { error: string }> {
  try {
    const { svg } = await mermaid.render(renderId, code);
    return { svg };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Ошибка рендера Mermaid" };
  }
}

export async function renderMermaidSafe(
  rawCode: string,
  renderId: string
): Promise<{ svg: string; code: string } | { error: string }> {
  ensureMermaidConfigured();

  const candidates = [
    sanitizeMermaidCode(rawCode),
    repairMermaidCode(rawCode),
    repairMermaidCode(rawCode, { aggressive: true }),
    repairMermaidCode(sanitizeMermaidCode(rawCode), { aggressive: true })
  ];

  const unique = [...new Set(candidates.filter(Boolean))];

  for (let index = 0; index < unique.length; index += 1) {
    const code = unique[index];
    if (!(await tryParse(code))) continue;
    const rendered = await tryRender(code, `${renderId}-${index}`);
    if ("svg" in rendered) {
      return { svg: rendered.svg, code };
    }
  }

  return {
    error:
      "Диаграмма содержит синтаксическую ошибку Mermaid. Нажмите «Сгенерировать заново по СТО»."
  };
}

export function resetMermaidInitForTests() {
  mermaidConfigured = false;
}
