export type ShipmentDateColumn = {
  index: number;
  iso: string;
};

export type ShipmentCountryFilter = "all" | "russia" | "china";

export type ShipmentColumnLayout = {
  metaIndices: number[];
  metaLabels: string[];
  dateColumns: ShipmentDateColumn[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isShipmentDateHeader(header: string): boolean {
  return ISO_DATE_RE.test(header.trim());
}

export function parseShipmentColumnLayout(header: string[]): ShipmentColumnLayout {
  const metaIndices: number[] = [];
  const metaLabels: string[] = [];
  const dateColumns: ShipmentDateColumn[] = [];

  header.forEach((label, index) => {
    const trimmed = label.trim();
    if (isShipmentDateHeader(trimmed)) {
      dateColumns.push({ index, iso: trimmed });
      return;
    }
    metaIndices.push(index);
    metaLabels.push(trimmed || `Колонка ${index + 1}`);
  });

  return { metaIndices, metaLabels, dateColumns };
}

export function resolveVisibleColumnIndices(
  layout: ShipmentColumnLayout,
  visibleMeta: Set<number>,
  dateFrom: string | null,
  dateTo: string | null
): number[] {
  const indices: number[] = [];

  for (const index of layout.metaIndices) {
    if (index === 0 || visibleMeta.has(index)) {
      indices.push(index);
    }
  }

  for (const column of layout.dateColumns) {
    if (dateFrom && column.iso < dateFrom) continue;
    if (dateTo && column.iso > dateTo) continue;
    indices.push(column.index);
  }

  return indices.sort((a, b) => a - b);
}

export function isFilterActive(
  layout: ShipmentColumnLayout,
  visibleMeta: Set<number>,
  dateFrom: string | null,
  dateTo: string | null
): boolean {
  const defaultMeta = new Set(layout.metaIndices);
  if (visibleMeta.size !== defaultMeta.size) return true;
  for (const index of defaultMeta) {
    if (!visibleMeta.has(index)) return true;
  }
  if (layout.dateColumns.length === 0) return false;
  const first = layout.dateColumns[0]?.iso ?? null;
  const last = layout.dateColumns[layout.dateColumns.length - 1]?.iso ?? null;
  if (dateFrom && dateFrom !== first) return true;
  if (dateTo && dateTo !== last) return true;
  return false;
}

export function resolveCountryColumnIndex(header: string[]): number | null {
  const index = header.findIndex((label) => label.trim().toLowerCase() === "страна");
  return index >= 0 ? index : null;
}

export function classifyShipmentCountry(value: string): "russia" | "china" | "unknown" {
  const normalized = value.trim().toLowerCase().replace(/ё/g, "е");
  if (!normalized) return "unknown";
  if (
    normalized.includes("китай") ||
    normalized.includes("кнр") ||
    normalized.includes("china") ||
    normalized.includes("гонконг") ||
    normalized.includes("hong kong")
  ) {
    return "china";
  }
  if (
    normalized.includes("россия") ||
    normalized.includes("российская федерация") ||
    normalized === "рф" ||
    normalized.includes("russia")
  ) {
    return "russia";
  }
  return "unknown";
}

export function rowMatchesCountryFilter(
  row: string[],
  countryColumnIndex: number | null,
  filter: ShipmentCountryFilter
): boolean {
  if (filter === "all") return true;
  if (countryColumnIndex === null) return false;

  const bucket = classifyShipmentCountry(row[countryColumnIndex] ?? "");
  if (filter === "russia") return bucket === "russia";
  if (filter === "china") return bucket === "china";
  return true;
}

export function shipmentCountryFilterLabel(filter: ShipmentCountryFilter): string {
  if (filter === "russia") return "Россия";
  if (filter === "china") return "Китай";
  return "Все";
}
