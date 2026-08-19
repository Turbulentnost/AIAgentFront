export type ChinaHongKongSheetSource = {
  title: string;
  gid?: string | number | null;
  values?: string[][];
  rowCount?: number;
  columnCount?: number;
};

export const MERGED_CHINA_HONG_KONG_SHEET_TITLE = "Китай + Гонконг";
export const MERGED_CHINA_HONG_KONG_SHEET_GID = "merged-china-hongkong";

const CHINA_SHEET_TITLES = new Set(["китай"]);
const HONG_KONG_SHEET_TITLES = new Set(["гонконг в работе", "итц в работе"]);

export function normalizeChinaSheetTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function padRow(row: string[], width: number): string[] {
  const cells = row.map((cell) => String(cell ?? ""));
  while (cells.length < width) {
    cells.push("");
  }
  return cells.slice(0, width);
}

function matrixWidth(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function isItcHeaderRow(row: string[]): boolean {
  const joined = row.join(" ").toLowerCase();
  return joined.includes("позици") && joined.includes("модел");
}

function pickSharedHeader(chinaValues: string[][], hkValues: string[][]): string[] {
  const width = Math.max(matrixWidth(chinaValues), matrixWidth(hkValues), 1);
  const chinaHeader = chinaValues[0] ?? [];
  const hkHeader = hkValues[0] ?? [];
  if (isItcHeaderRow(chinaHeader)) {
    return padRow(chinaHeader, width);
  }
  if (isItcHeaderRow(hkHeader)) {
    return padRow(hkHeader, width);
  }
  return padRow(chinaHeader.length ? chinaHeader : hkHeader, width);
}

function buildSectionSeparator(label: string, width: number): string[] {
  const row = Array(width).fill("");
  row[0] = label;
  return row;
}

function bodyRows(values: string[][]): string[][] {
  if (values.length <= 1) return [];
  return values.slice(1);
}

export function findChinaSheet(sheets: ChinaHongKongSheetSource[]): ChinaHongKongSheetSource | undefined {
  return sheets.find((sheet) => CHINA_SHEET_TITLES.has(normalizeChinaSheetTitle(sheet.title)));
}

export function findHongKongSheet(
  sheets: ChinaHongKongSheetSource[]
): ChinaHongKongSheetSource | undefined {
  return sheets.find((sheet) => HONG_KONG_SHEET_TITLES.has(normalizeChinaSheetTitle(sheet.title)));
}

/** Объединяет листы «КИТАЙ» и «Гонконг В РАБОТЕ» для просмотра в одной таблице. */
export function buildMergedChinaHongKongSheet(
  chinaSheet: ChinaHongKongSheetSource,
  hongKongSheet: ChinaHongKongSheetSource
): ChinaHongKongSheetSource {
  const chinaValues = chinaSheet.values ?? [];
  const hkValues = hongKongSheet.values ?? [];
  const width = Math.max(matrixWidth(chinaValues), matrixWidth(hkValues), 1);
  const header = pickSharedHeader(chinaValues, hkValues);
  const merged: string[][] = [header];

  merged.push(
    buildSectionSeparator(`— ${chinaSheet.title} —`, width),
    ...bodyRows(chinaValues).map((row) => padRow(row, width)),
    buildSectionSeparator(`— ${hongKongSheet.title} —`, width),
    ...bodyRows(hkValues).map((row) => padRow(row, width))
  );

  return {
    title: MERGED_CHINA_HONG_KONG_SHEET_TITLE,
    gid: MERGED_CHINA_HONG_KONG_SHEET_GID,
    rowCount: merged.length,
    columnCount: width,
    values: merged,
  };
}

export function canMergeChinaHongKongSheets(sheets: ChinaHongKongSheetSource[]): boolean {
  return Boolean(findChinaSheet(sheets) && findHongKongSheet(sheets));
}
