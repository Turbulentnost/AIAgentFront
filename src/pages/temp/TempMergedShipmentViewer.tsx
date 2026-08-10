/**
 * TEMP(Aveon merged shipment schedule viewer) — удалить вместе с flip-модалкой.
 */
import { useCallback, useEffect, useMemo, useRef, useState, memo, type ReactNode } from "react";
import { Download, FlipHorizontal2, Loader2, Search, X } from "lucide-react";
import ShipmentColumnFilterMenu, { type ShipmentRowSort } from "./ShipmentColumnFilterMenu";
import {
  isFilterActive,
  parseShipmentColumnLayout,
  resolveVisibleColumnIndices,
} from "./mergedShipmentColumns";
import styles from "./TempMergedShipmentViewer.module.css";
export type MergedShipmentStats = {
  nomenclature_total?: number;
  date_columns?: number;
  ingested_files?: string[];
};

type Props = {
  open?: boolean;
  embedded?: boolean;
  loading?: boolean;
  error?: string | null;
  values: string[][];
  fileName: string;
  stats?: MergedShipmentStats | null;
  sourceCount?: number;
  changedCells?: Array<{ row: number; col: number }>;
  onExport: () => void;
  onClose: () => void;
  onBackToShiftAssignment?: () => void;
  onBackToShiftAssignmentHover?: () => void;
};

function formatMeta(
  values: string[][],
  stats: MergedShipmentStats | null | undefined,
  sourceCount: number | undefined,
  loading: boolean
): string {
  if (loading) return "загрузка…";
  const parts: string[] = [];
  if (sourceCount && sourceCount > 0) {
    parts.push(`из ${sourceCount} ${sourceCount === 1 ? "файла" : "файлов"}`);
  }
  const nomenclatureTotal = stats?.nomenclature_total;
  if (typeof nomenclatureTotal === "number") {
    parts.push(`${nomenclatureTotal} номенклатур`);
  }
  const dateColumns = stats?.date_columns;
  if (typeof dateColumns === "number") {
    parts.push(`${dateColumns} дат отгрузки`);
  }
  if (!parts.length) {
    parts.push(`${Math.max(values.length - 1, 0)} строк`);
  }
  return parts.join(" · ");
}

function TruncatedTableCell({
  as: Tag,
  children,
  changed = false,
}: {
  as: "th" | "td";
  children: ReactNode;
  changed?: boolean;
}) {
  const contentRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const measure = useCallback(() => {
    if (expanded) return;
    const element = contentRef.current;
    if (!element) return;
    setTruncated(element.scrollWidth > element.clientWidth + 1);
  }, [expanded]);

  useEffect(() => {
    measure();
    const element = contentRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, children]);

  return (
    <Tag
      className={[
        truncated ? styles.cellTruncated : "",
        changed ? styles.cellChanged : "",
      ].filter(Boolean).join(" ") || undefined}
      onMouseEnter={() => {
        if (truncated) setExpanded(true);
      }}
      onMouseLeave={() => setExpanded(false)}
    >
      <span ref={contentRef} className={styles.cellContent}>
        {children}
      </span>
      {truncated && expanded ? (
        <span className={styles.cellPopover} aria-hidden="true">
          {children}
        </span>
      ) : null}
    </Tag>
  );
}

type BodyRow = {
  row: string[];
  originalIndex: number;
};

function parseQty(value: string): number {
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function MergedShipmentTable({
  header,
  bodyRows,
  visibleIndices,
  changedCells,
}: {
  header: string[];
  bodyRows: BodyRow[];
  visibleIndices: number[];
  changedCells: Array<{ row: number; col: number }>;
}) {
  const changedKeys = new Set(changedCells.map((cell) => `${cell.row}:${cell.col}`));
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {visibleIndices.map((colIndex) => (
              <TruncatedTableCell as="th" key={`h-${colIndex}`}>
                {header[colIndex] ?? ""}
              </TruncatedTableCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map(({ row, originalIndex }) => (
            <tr key={`r-${originalIndex}`}>
              {visibleIndices.map((colIndex) => (
                <TruncatedTableCell
                  as="td"
                  key={`c-${originalIndex}-${colIndex}`}
                  changed={changedKeys.has(`${originalIndex + 1}:${colIndex}`)}
                >
                  {row[colIndex] ?? ""}
                </TruncatedTableCell>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function TempMergedShipmentViewer({
  open = true,
  embedded = false,
  loading = false,
  error = null,
  values,
  fileName,
  stats = null,
  sourceCount,
  changedCells = [],
  onExport,
  onClose,
  onBackToShiftAssignment,
  onBackToShiftAssignmentHover,
}: Props) {
  const [nomenclatureQuery, setNomenclatureQuery] = useState("");
  const [visibleMeta, setVisibleMeta] = useState<Set<number>>(() => new Set());
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [rowSort, setRowSort] = useState<ShipmentRowSort>("default");

  const header = values[0] ?? [];
  const body = values.length > 1 ? values.slice(1) : [];
  const columnLayout = useMemo(() => parseShipmentColumnLayout(header), [header]);

  useEffect(() => {
    setVisibleMeta(new Set(columnLayout.metaIndices));
    setDateFrom(null);
    setDateTo(null);
    setRowSort("default");
  }, [fileName, columnLayout.metaIndices]);

  const visibleIndices = useMemo(
    () => resolveVisibleColumnIndices(columnLayout, visibleMeta, dateFrom, dateTo),
    [columnLayout, visibleMeta, dateFrom, dateTo]
  );

  const dateColumnSet = useMemo(
    () => new Set(columnLayout.dateColumns.map((column) => column.index)),
    [columnLayout.dateColumns]
  );

  const normalizedQuery = nomenclatureQuery.trim().toLowerCase();

  const filteredBodyRows = useMemo<BodyRow[]>(() => {
    let indexedRows = body.map((row, originalIndex) => ({ row, originalIndex }));
    if (normalizedQuery) {
      indexedRows = indexedRows.filter(({ row }) =>
        (row[0] ?? "").toLowerCase().includes(normalizedQuery)
      );
    }
    if (rowSort === "default") return indexedRows;

    const qtyIndices = visibleIndices.filter((index) => dateColumnSet.has(index));
    return [...indexedRows].sort((left, right) => {
      if (rowSort === "name-asc" || rowSort === "name-desc") {
        const cmp = (left.row[0] ?? "").localeCompare(right.row[0] ?? "", "ru");
        return rowSort === "name-asc" ? cmp : -cmp;
      }
      const leftSum = qtyIndices.reduce((sum, index) => sum + parseQty(left.row[index] ?? ""), 0);
      const rightSum = qtyIndices.reduce((sum, index) => sum + parseQty(right.row[index] ?? ""), 0);
      return rightSum - leftSum;
    });
  }, [body, dateColumnSet, normalizedQuery, rowSort, visibleIndices]);

  const filterActive = useMemo(
    () => isFilterActive(columnLayout, visibleMeta, dateFrom, dateTo) || rowSort !== "default",
    [columnLayout, visibleMeta, dateFrom, dateTo, rowSort]
  );

  const resetFilters = useCallback(() => {
    setVisibleMeta(new Set(columnLayout.metaIndices));
    setDateFrom(null);
    setDateTo(null);
    setRowSort("default");
  }, [columnLayout.metaIndices]);

  if (!open && !embedded) return null;
  const panel = (
    <div
      className={styles.modal}
      role="dialog"
      aria-modal={embedded ? undefined : "true"}
      aria-labelledby="temp-merged-shipment-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className={styles.header}>
        <div>
          <h2 id="temp-merged-shipment-title" className={styles.title}>
            Объединённый график получения комплектующих
          </h2>
          <p className={styles.meta}>
            {formatMeta(values, stats, sourceCount, loading)}
            {filterActive ? " · фильтр колонок" : ""}
            {normalizedQuery && body.length > 0
              ? ` · показано ${filteredBodyRows.length} из ${body.length}`
              : ""}
          </p>
        </div>
        <div className={styles.headerToolbar}>
          <ShipmentColumnFilterMenu
            layout={columnLayout}
            visibleMeta={visibleMeta}
            dateFrom={dateFrom}
            dateTo={dateTo}
            rowSort={rowSort}
            active={filterActive}
            onVisibleMetaChange={setVisibleMeta}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onRowSortChange={setRowSort}
            onReset={resetFilters}
          />
          <div className={styles.headerSearch}>          <Search size={15} className={styles.searchIcon} aria-hidden />
          <input
            type="text"
            className={styles.searchInput}
            value={nomenclatureQuery}
            onChange={(event) => setNomenclatureQuery(event.target.value)}
            placeholder="Поиск по номенклатуре"
            aria-label="Поиск по номенклатуре"
          />
          {nomenclatureQuery ? (
            <button
              type="button"
              className={styles.searchClearBtn}
              onClick={() => setNomenclatureQuery("")}
              aria-label="Очистить поиск"
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>
        </div>
        <div className={styles.headerActions}>          {onBackToShiftAssignment ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onMouseEnter={onBackToShiftAssignmentHover}
              onFocus={onBackToShiftAssignmentHover}
              onClick={onBackToShiftAssignment}
            >
              <FlipHorizontal2 size={16} aria-hidden />
              Сменное задание
            </button>
          ) : null}
          <button
            type="button"
            className={styles.exportBtn}
            disabled={loading || Boolean(error) || values.length === 0}
            onClick={onExport}
          >
            <Download size={16} aria-hidden />
            Выгрузить в Excel
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 className={styles.spinner} size={22} aria-hidden />
            <span>Загрузка объединённого графика…</span>
          </div>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : values.length === 0 ? (
          <p className={styles.empty}>Объединённый график получения комплектующих ещё не сформирован.</p>
        ) : filteredBodyRows.length === 0 ? (
          <p className={styles.empty}>
            {normalizedQuery
              ? `По запросу «${nomenclatureQuery.trim()}» номенклатура не найдена.`
              : "Нет строк для выбранных колонок и диапазона дат."}
          </p>
        ) : visibleIndices.length === 0 ? (
          <p className={styles.empty}>Выберите хотя бы одну колонку в фильтре.</p>
        ) : (
          <MergedShipmentTable
            header={header}
            bodyRows={filteredBodyRows}
            visibleIndices={visibleIndices}
            changedCells={changedCells}
          />
        )}      </div>
    </div>
  );

  if (embedded) return panel;

  return (
    <div
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {panel}
    </div>
  );
}

export default memo(TempMergedShipmentViewer);
