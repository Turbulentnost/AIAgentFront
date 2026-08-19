/**
 * TEMP(Aveon Google Sheets viewer) — удалить вместе с кнопкой на DocumentAnalysisAgent.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Layers, Loader2, X } from "lucide-react";
import styles from "./TempGoogleSheetsViewer.module.css";
import {
  buildMergedChinaHongKongSheet,
  canMergeChinaHongKongSheets,
  findChinaSheet,
  findHongKongSheet,
  MERGED_CHINA_HONG_KONG_SHEET_GID,
} from "./mergeChinaHongKongSheets";

export type GoogleSheetTab = {
  title: string;
  gid: string | number | null;
  rowCount: number;
  columnCount: number;
  values: string[][];
  error?: string | null;
};

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  spreadsheetTitle?: string | null;
  sheets?: GoogleSheetTab[];
  activeSheetIndex?: number;
  onSheetChange?: (index: number) => void;
  /** Legacy single-sheet props (SummaryReferencePanel). */
  sheetTitle?: string;
  values?: string[][];
  onClose: () => void;
};

function buildLegacySheets(sheetTitle: string, values: string[][]): GoogleSheetTab[] {
  if (!values.length) return [];
  return [
    {
      title: sheetTitle,
      gid: null,
      rowCount: values.length,
      columnCount: Math.max(...values.map((row) => row.length), 0),
      values,
    },
  ];
}

export default function TempGoogleSheetsViewer({
  open,
  loading,
  error,
  spreadsheetTitle,
  sheets,
  activeSheetIndex,
  onSheetChange,
  sheetTitle = "ИТЦ В РАБОТЕ",
  values: legacyValues = [],
  onClose,
}: Props) {
  const [internalSheetIndex, setInternalSheetIndex] = useState(0);
  const [mergedTabVisible, setMergedTabVisible] = useState(false);

  const resolvedSheets = useMemo(() => {
    if (sheets?.length) return sheets;
    return buildLegacySheets(sheetTitle, legacyValues);
  }, [sheetTitle, sheets, legacyValues]);

  const mergedChinaHongKongSheet = useMemo(() => {
    const chinaSheet = findChinaSheet(resolvedSheets);
    const hongKongSheet = findHongKongSheet(resolvedSheets);
    if (!chinaSheet || !hongKongSheet) return null;
    return buildMergedChinaHongKongSheet(chinaSheet, hongKongSheet);
  }, [resolvedSheets]);

  const displaySheets = useMemo(() => {
    if (!mergedTabVisible || !mergedChinaHongKongSheet) return resolvedSheets;
    return [...resolvedSheets, mergedChinaHongKongSheet];
  }, [mergedChinaHongKongSheet, mergedTabVisible, resolvedSheets]);

  const mergeAvailable = canMergeChinaHongKongSheets(resolvedSheets);

  useEffect(() => {
    if (open) {
      setInternalSheetIndex(0);
      setMergedTabVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const currentSheetIndex = activeSheetIndex ?? internalSheetIndex;
  const setSheetIndex = onSheetChange ?? setInternalSheetIndex;

  const safeIndex = displaySheets.length
    ? Math.min(Math.max(currentSheetIndex, 0), displaySheets.length - 1)
    : 0;
  const activeSheet = displaySheets[safeIndex];
  const isMergedSheetActive = activeSheet?.gid === MERGED_CHINA_HONG_KONG_SHEET_GID;

  const openMergedSheet = () => {
    if (!mergedChinaHongKongSheet) return;
    setMergedTabVisible(true);
    setSheetIndex(resolvedSheets.length);
  };

  const sheetValues = activeSheet?.values ?? [];
  const header = sheetValues[0] ?? [];
  const body = sheetValues.length > 1 ? sheetValues.slice(1) : [];
  const colCount = Math.max(header.length, ...body.map((row) => row.length), 0);

  const goPrev = () => setSheetIndex(Math.max(0, safeIndex - 1));
  const goNext = () => setSheetIndex(Math.min(displaySheets.length - 1, safeIndex + 1));

  function isSectionMarkerRow(row: string[]): boolean {
    const marker = String(row[0] ?? "").trim();
    return marker.startsWith("—") && marker.endsWith("—");
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="temp-google-sheets-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <h2 id="temp-google-sheets-title" className={styles.title}>
              {spreadsheetTitle || "График комплектующих · Китай"}
            </h2>
            <p className={styles.meta}>
              Google Sheets
              {loading
                ? " · загрузка…"
                : resolvedSheets.length
                  ? ` · ${resolvedSheets.length} листов`
                  : ""}
              {mergeAvailable ? " · доступно объединение Китай + Гонконг" : ""}
            </p>
          </div>
          <div className={styles.headerActions}>
            {mergeAvailable ? (
              <button
                type="button"
                className={`${styles.mergeBtn} ${isMergedSheetActive ? styles.mergeBtnActive : ""}`}
                onClick={openMergedSheet}
                title="Объединить листы «КИТАЙ» и «Гонконг В РАБОТЕ» в один просмотр"
              >
                <Layers size={15} strokeWidth={2.2} aria-hidden="true" />
                <span>Китай + Гонконг</span>
              </button>
            ) : null}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        {displaySheets.length > 1 ? (
          <div className={styles.sheetNav} role="navigation" aria-label="Листы Google Sheets">
            <button
              type="button"
              className={styles.sheetNavBtn}
              onClick={goPrev}
              disabled={loading || safeIndex <= 0}
              aria-label="Предыдущий лист"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <div className={styles.sheetTabs} role="tablist">
              {displaySheets.map((sheet, index) => (
                <button
                  key={`${sheet.gid ?? sheet.title}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={index === safeIndex}
                  className={`${styles.sheetTab} ${index === safeIndex ? styles.sheetTabActive : ""} ${
                    sheet.gid === MERGED_CHINA_HONG_KONG_SHEET_GID ? styles.sheetTabMerged : ""
                  }`}
                  onClick={() => setSheetIndex(index)}
                  title={sheet.title}
                >
                  {sheet.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.sheetNavBtn}
              onClick={goNext}
              disabled={loading || safeIndex >= displaySheets.length - 1}
              aria-label="Следующий лист"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
            <span className={styles.sheetCounter}>
              {safeIndex + 1} / {displaySheets.length}
            </span>
          </div>
        ) : null}

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 className={styles.spinner} size={22} aria-hidden />
              <span>Загрузка листов Google Sheets…</span>
            </div>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : !activeSheet ? (
            <p className={styles.empty}>Листы не найдены.</p>
          ) : activeSheet.error ? (
            <p className={styles.error}>{activeSheet.error}</p>
          ) : sheetValues.length === 0 ? (
            <p className={styles.empty}>Лист «{activeSheet.title}» пуст.</p>
          ) : (
            <>
              <p className={styles.sheetMeta}>
                <strong>{activeSheet.title}</strong>
                <span>
                  {isMergedSheetActive
                    ? `${sheetValues.length} строк · ${colCount} кол. · объединение Китай + Гонконг`
                    : `${sheetValues.length} строк · ${colCount} кол.`}
                </span>
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {Array.from({ length: colCount }, (_, index) => (
                        <th key={`h-${index}`}>{header[index] ?? ""}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((row, rowIndex) => (
                      <tr
                        key={`r-${rowIndex}`}
                        className={
                          isMergedSheetActive && isSectionMarkerRow(row)
                            ? styles.tableSectionRow
                            : undefined
                        }
                      >
                        {Array.from({ length: colCount }, (_, colIndex) => (
                          <td key={`c-${rowIndex}-${colIndex}`}>{row[colIndex] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
