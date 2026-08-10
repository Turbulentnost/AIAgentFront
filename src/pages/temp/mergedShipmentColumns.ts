export type ShipmentDateColumn = {
  index: number;
  iso: string;
};

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
