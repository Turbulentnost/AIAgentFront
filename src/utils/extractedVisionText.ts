import type { CSSProperties } from "react";

export type ExtractedViewerChunk = {
  id: string;
  source_id: string;
  text?: string | null;
  metadata?: Record<string, unknown> | null;
  chunk_index?: number | null;
  page_number?: number | null;
  section_title?: string | null;
  fragment_type?: string | null;
};

export type ExtractedContentBlock =
  | { kind: "text"; id: string; text: string; chunk: ExtractedViewerChunk; alignment?: CSSProperties }
  | {
      kind: "table";
      id: string;
      tableKey: string;
      caption?: string;
      headers: string[];
      rows: string[][];
      chunks: ExtractedViewerChunk[];
      page_number?: number | null;
    };

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (item == null ? "" : String(item)));
}

function stripCodeFence(value: string): string {
  let stripped = value.trim();
  if (stripped.startsWith("```")) {
    stripped = stripped.split("\n", 1)[1] ?? stripped;
    stripped = stripped.split("```")[0] ?? stripped;
  }
  return stripped.trim();
}

function repairTruncatedJson(text: string): string {
  const candidate = text.trim().replace(/,\s*$/, "");
  const openBraces = (candidate.match(/\{/g) ?? []).length - (candidate.match(/\}/g) ?? []).length;
  const openBrackets = (candidate.match(/\[/g) ?? []).length - (candidate.match(/\]/g) ?? []).length;
  return candidate + "]".repeat(Math.max(0, openBrackets)) + "}".repeat(Math.max(0, openBraces));
}

function tryLoadVisionPayload(text: string): Record<string, unknown> | null {
  const stripped = stripCodeFence(text);
  if (!stripped.startsWith("{")) return null;
  for (const candidate of [stripped, repairTruncatedJson(stripped)]) {
    try {
      const payload = JSON.parse(candidate) as unknown;
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return payload as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function normalizeVisionTables(tablesRaw: unknown): Array<{ caption?: string; rows: string[][] }> {
  if (!Array.isArray(tablesRaw)) return [];
  const normalized: Array<{ caption?: string; rows: string[][] }> = [];
  for (const table of tablesRaw) {
    if (!table || typeof table !== "object") continue;
    const record = table as Record<string, unknown>;
    const rowsInput = record.rows;
    if (!Array.isArray(rowsInput)) continue;
    const rows = rowsInput
      .filter((row): row is unknown[] => Array.isArray(row))
      .map((row) => row.map((cell) => (cell == null ? "" : String(cell).trim())))
      .filter((row) => row.some(Boolean));
    if (!rows.length) continue;
    const headers = asStringArray(record.headers);
    const mergedRows = headers.length ? [headers, ...rows] : rows;
    const caption = typeof record.caption === "string" ? record.caption.trim() : "";
    normalized.push({ caption: caption || undefined, rows: mergedRows });
  }
  return normalized;
}

function normalizeVisionTextBlocks(payload: Record<string, unknown>): string[] {
  const blocksRaw = payload.text_blocks;
  if (Array.isArray(blocksRaw)) {
    const blocks = blocksRaw.map((item) => String(item ?? "").trim()).filter(Boolean);
    if (blocks.length) return blocks;
  }
  const textRaw = payload.text;
  if (typeof textRaw === "string" && textRaw.trim()) {
    return textRaw
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }
  return [];
}

function alignmentFromBbox(bbox: unknown, pageWidth = 595): CSSProperties | undefined {
  if (!Array.isArray(bbox) || bbox.length < 4) return undefined;
  const x0 = Number(bbox[0]);
  const x1 = Number(bbox[2]);
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) return undefined;
  const width = x1 - x0;
  const center = (x0 + x1) / 2;
  const widthPercent = `${Math.min(100, Math.max(28, (width / pageWidth) * 100))}%`;
  if (width >= pageWidth * 0.72) {
    return { width: "100%", textAlign: "justify" };
  }
  if (center >= pageWidth * 0.62) {
    return { width: widthPercent, marginLeft: "auto", marginRight: 0, textAlign: "right" };
  }
  if (center <= pageWidth * 0.38) {
    return { width: widthPercent, marginRight: "auto", marginLeft: 0, textAlign: "left" };
  }
  return { width: widthPercent, marginInline: "auto", textAlign: "center" };
}

function sortKeyFromBbox(bbox: unknown, fallback: number): number {
  if (Array.isArray(bbox) && bbox.length >= 2 && Number.isFinite(Number(bbox[1]))) {
    return Number(bbox[1]);
  }
  return fallback;
}

function normalizePageTextBlocks(textBlocksRaw: unknown): Array<{ text: string; bbox?: unknown }> {
  if (!Array.isArray(textBlocksRaw)) return [];
  const blocks: Array<{ text: string; bbox?: unknown }> = [];
  for (const item of textBlocksRaw) {
    if (typeof item === "string" && item.trim()) {
      blocks.push({ text: item.trim() });
      continue;
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const text = String(record.text ?? "").trim();
      if (text) blocks.push({ text, bbox: record.bbox });
    }
  }
  return blocks;
}

function normalizePageTables(tablesRaw: unknown): Array<{ caption?: string; rows: string[][]; bbox?: unknown }> {
  if (!Array.isArray(tablesRaw)) return [];
  const normalized: Array<{ caption?: string; rows: string[][]; bbox?: unknown }> = [];
  for (const table of tablesRaw) {
    if (!table || typeof table !== "object") continue;
    const record = table as Record<string, unknown>;
    const rowsInput = record.rows;
    if (!Array.isArray(rowsInput)) continue;
    const rows = rowsInput
      .filter((row): row is unknown[] => Array.isArray(row))
      .map((row) => row.map((cell) => (cell == null ? "" : String(cell).trim())))
      .filter((row) => row.some(Boolean));
    if (!rows.length) continue;
    const headers = asStringArray(record.headers);
    const mergedRows = headers.length ? [headers, ...rows] : rows;
    const caption = typeof record.caption === "string" ? record.caption.trim() : "";
    normalized.push({
      caption: caption || undefined,
      rows: mergedRows,
      bbox: record.bbox
    });
  }
  return normalized;
}

function pageRecordToBlocks(page: Record<string, unknown>, pageNumber: number): ExtractedContentBlock[] {
  const blocks: ExtractedContentBlock[] = [];
  const textBlocks = normalizePageTextBlocks(page.text_blocks);
  const tables = normalizePageTables(page.tables);
  const ordered: Array<{ sort: number; index: number; block: ExtractedContentBlock }> = [];

  textBlocks.forEach((item, index) => {
    ordered.push({
      sort: sortKeyFromBbox(item.bbox, index),
      index,
      block: {
        kind: "text",
        id: `page-${pageNumber}-text-${index}`,
        text: item.text,
        chunk: {
          id: `page-${pageNumber}-text-${index}`,
          source_id: "",
          page_number: pageNumber,
          fragment_type: "paragraph"
        },
        alignment: alignmentFromBbox(item.bbox)
      }
    });
  });

  tables.forEach((table, tableIndex) => {
    const headers = table.rows[0] ?? [];
    const rows = table.rows.slice(1);
    ordered.push({
      sort: sortKeyFromBbox(table.bbox, textBlocks.length + tableIndex),
      index: textBlocks.length + tableIndex,
      block: {
        kind: "table",
        id: `page-${pageNumber}-table-${tableIndex}`,
        tableKey: `${pageNumber}-${table.caption ?? tableIndex}`,
        caption: table.caption,
        headers: Array.from({ length: Math.max(headers.length, ...rows.map((row) => row.length), 1) }, (_, index) => headers[index] || `Колонка ${index + 1}`),
        rows: rows.length ? rows : [headers],
        chunks: [],
        page_number: pageNumber
      }
    });
  });

  if (!ordered.length) {
    const fallbackText = String(page.text ?? "").trim();
    if (fallbackText) {
      ordered.push({
        sort: 0,
        index: 0,
        block: {
          kind: "text",
          id: `page-${pageNumber}-text`,
          text: fallbackText,
          chunk: {
            id: `page-${pageNumber}-text`,
            source_id: "",
            page_number: pageNumber,
            fragment_type: "page"
          }
        }
      });
    }
  }

  ordered.sort((left, right) => left.sort - right.sort || left.index - right.index);
  return ordered.map((item) => item.block);
}

export function buildBlocksFromExtractedPayload(payload: Record<string, unknown>): ExtractedContentBlock[] {
  const pagesRaw = payload.pages;
  if (Array.isArray(pagesRaw) && pagesRaw.length) {
    const pages = pagesRaw
      .filter((page): page is Record<string, unknown> => Boolean(page) && typeof page === "object")
      .map((page, index) => ({
        page,
        pageNumber: typeof page.page_number === "number" ? page.page_number : index + 1
      }))
      .sort((left, right) => left.pageNumber - right.pageNumber);

    return pages.flatMap(({ page, pageNumber }) => pageRecordToBlocks(page, pageNumber));
  }

  return pageRecordToBlocks(payload, 1);
}

function visionPageToBlocks(
  page: Record<string, unknown>,
  chunk: ExtractedViewerChunk,
  blockIndexStart: number
): ExtractedContentBlock[] {
  const pageNumber = typeof page.page_number === "number" ? page.page_number : chunk.page_number;
  const blocks: ExtractedContentBlock[] = [];
  let blockIndex = blockIndexStart;

  for (const paragraph of normalizeVisionTextBlocks(page)) {
    blocks.push({
      kind: "text",
      id: `${chunk.id}-vision-text-${blockIndex}`,
      text: paragraph,
      chunk: { ...chunk, page_number: pageNumber ?? chunk.page_number, fragment_type: "paragraph" },
      alignment: alignmentFromBbox(chunk.metadata?.bbox)
    });
    blockIndex += 1;
  }

  for (const table of normalizeVisionTables(page.tables)) {
    const headers = table.rows[0] ?? [];
    const rows = table.rows.slice(1);
    blocks.push({
      kind: "table",
      id: `${chunk.id}-vision-table-${blockIndex}`,
      tableKey: `${pageNumber ?? "p"}-${table.caption ?? blockIndex}`,
      caption: table.caption,
      headers: Array.from({ length: Math.max(headers.length, ...rows.map((row) => row.length), 1) }, (_, index) => headers[index] || `Колонка ${index + 1}`),
      rows: rows.length ? rows : [headers],
      chunks: [chunk],
      page_number: pageNumber ?? chunk.page_number
    });
    blockIndex += 1;
  }

  return blocks;
}

export function tryParseVisionPayloadToBlocks(text: string, chunk: ExtractedViewerChunk): ExtractedContentBlock[] | null {
  const payload = tryLoadVisionPayload(text);
  if (!payload) return null;

  const pages = payload.pages;
  if (Array.isArray(pages) && pages.length) {
    const blocks: ExtractedContentBlock[] = [];
    const sortedPages = [...pages]
      .filter((page): page is Record<string, unknown> => Boolean(page) && typeof page === "object")
      .sort((left, right) => {
        const leftNum = typeof left.page_number === "number" ? left.page_number : Number.MAX_SAFE_INTEGER;
        const rightNum = typeof right.page_number === "number" ? right.page_number : Number.MAX_SAFE_INTEGER;
        return leftNum - rightNum;
      });
    sortedPages.forEach((page, index) => {
      blocks.push(...visionPageToBlocks(page, chunk, index));
    });
    return blocks.length ? blocks : null;
  }

  const directBlocks = visionPageToBlocks(payload, chunk, 0);
  return directBlocks.length ? directBlocks : null;
}

export function sourceBlockMetadata(chunk: ExtractedViewerChunk) {
  const metadata = chunk.metadata ?? {};
  const sourceBlocks = metadata.source_blocks;
  if (Array.isArray(sourceBlocks) && sourceBlocks[0] && typeof sourceBlocks[0] === "object") {
    return sourceBlocks[0] as Record<string, unknown>;
  }
  return metadata;
}

function tableKeyFromMetadata(metadata: Record<string, unknown>) {
  return [metadata.table_caption, metadata.sheet_name, metadata.page_number, metadata.table_index, metadata.cell_range]
    .map((item) => String(item ?? ""))
    .join("|");
}

function resolveChunkPageNumber(chunk: ExtractedViewerChunk): number {
  if (typeof chunk.page_number === "number") return chunk.page_number;
  const metadata = chunk.metadata ?? {};
  if (typeof metadata.page_number === "number") return metadata.page_number;
  const pageNumbers = metadata.page_numbers;
  if (Array.isArray(pageNumbers) && typeof pageNumbers[0] === "number") return pageNumbers[0];
  return Number.MAX_SAFE_INTEGER;
}

export function buildExtractedContentBlocks(chunks: ExtractedViewerChunk[]): ExtractedContentBlock[] {
  const blocks: ExtractedContentBlock[] = [];
  const ordered = [...chunks].sort((left, right) => {
    const leftPage = resolveChunkPageNumber(left);
    const rightPage = resolveChunkPageNumber(right);
    if (leftPage !== rightPage) return leftPage - rightPage;
    const leftIndex = left.chunk_index ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = right.chunk_index ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

  for (const chunk of ordered) {
    const metadata = sourceBlockMetadata(chunk);
    const headers = asStringArray(metadata.headers);
    const rowValues = asStringArray(metadata.row_values);
    const isTableRow =
      (metadata.fragment_type === "table_row" || metadata.chunk_kind === "table_row" || chunk.fragment_type === "table_row") &&
      rowValues.length > 0;

    if (isTableRow) {
      const key = tableKeyFromMetadata(metadata);
      const last = blocks[blocks.length - 1];
      const normalizedHeaders = Array.from({ length: Math.max(headers.length, rowValues.length) }, (_, index) => headers[index] || `Колонка ${index + 1}`);
      if (last?.kind === "table" && last.tableKey === key) {
        last.rows.push(rowValues);
        last.chunks.push(chunk);
      } else {
        blocks.push({
          kind: "table",
          id: `${key || chunk.id}-${blocks.length}`,
          tableKey: key,
          caption: String(metadata.table_caption || metadata.sheet_name || chunk.section_title || ""),
          headers: normalizedHeaders,
          rows: [rowValues],
          chunks: [chunk],
          page_number: chunk.page_number
        });
      }
      continue;
    }

    const text = (chunk.text || "").trim();
    if (!text) continue;

    const visionBlocks = tryParseVisionPayloadToBlocks(text, chunk);
    if (visionBlocks?.length) {
      blocks.push(...visionBlocks);
      continue;
    }

    blocks.push({
      kind: "text",
      id: chunk.id,
      text,
      chunk,
      alignment: alignmentFromBbox(metadata.bbox)
    });
  }

  return blocks;
}

export function groupExtractedBlocksByPage(blocks: ExtractedContentBlock[]) {
  const groups = new Map<number | "unknown", ExtractedContentBlock[]>();
  for (const block of blocks) {
    const pageNumber =
      block.kind === "table"
        ? block.page_number ?? block.chunks[0]?.page_number
        : block.chunk.page_number;
    const key = typeof pageNumber === "number" ? pageNumber : "unknown";
    const bucket = groups.get(key) ?? [];
    bucket.push(block);
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === "unknown") return 1;
      if (right === "unknown") return -1;
      return left - right;
    })
    .map(([pageNumber, pageBlocks]) => ({ pageNumber, blocks: pageBlocks }));
}

export function documentChunkToViewerChunk(
  source: { id: string },
  chunk: {
    id: string;
    content?: string | null;
    text?: string | null;
    metadata?: Record<string, unknown> | null;
    chunk_metadata?: Record<string, unknown> | null;
    chunk_index?: number | null;
    page_number?: number | null;
    section_title?: string | null;
  }
): ExtractedViewerChunk {
  const metadata = chunk.metadata ?? chunk.chunk_metadata ?? null;
  const sourceBlocks = metadata?.source_blocks;
  const firstSourceBlock =
    Array.isArray(sourceBlocks) && sourceBlocks[0] && typeof sourceBlocks[0] === "object"
      ? (sourceBlocks[0] as Record<string, unknown>)
      : metadata ?? {};

  return {
    id: chunk.id,
    source_id: source.id,
    text: chunk.content || chunk.text,
    metadata,
    chunk_index: chunk.chunk_index,
    page_number:
      chunk.page_number ??
      (typeof metadata?.page_number === "number" ? metadata.page_number : null) ??
      (Array.isArray(metadata?.page_numbers) && typeof metadata.page_numbers[0] === "number" ? metadata.page_numbers[0] : null),
    section_title: chunk.section_title,
    fragment_type: String(firstSourceBlock.fragment_type || firstSourceBlock.chunk_kind || "")
  };
}
