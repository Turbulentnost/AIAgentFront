import type { BrowserExtractMode, BrowserRunTable, ExtractedPageContent } from "./types";

export function extractPageContent(documentRef: Document, extractMode: BrowserExtractMode | string): ExtractedPageContent {
  const cloned = documentRef.documentElement.cloneNode(true) as HTMLElement;
  cloned.querySelectorAll("script, style, noscript").forEach((node) => node.remove());
  const bodyText = normalizeText(documentRef.body?.innerText ?? documentRef.documentElement.textContent ?? "");

  return {
    title: documentRef.title || null,
    text: extractMode === "html" ? null : bodyText,
    html: extractMode === "html" ? cloned.outerHTML : null,
    tables: extractMode === "table" ? extractTables(documentRef) : [],
    metadata: {
      loaded_at: new Date().toISOString(),
      extract_mode: extractMode,
      location: documentRef.location?.href
    }
  };
}

export function extractTables(documentRef: Document): BrowserRunTable[] {
  return Array.from(documentRef.querySelectorAll("table")).map((table) => {
    const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th,td")).map((cell) => normalizeText(cell.textContent ?? ""))
    );
    const headers = rows[0] ?? [];
    return { headers, rows: rows.slice(headers.length ? 1 : 0) };
  });
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
