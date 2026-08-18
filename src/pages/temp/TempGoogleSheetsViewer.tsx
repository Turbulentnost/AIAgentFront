/**
 * TEMP(Aveon Google Sheets viewer) — удалить вместе с кнопкой на DocumentAnalysisAgent.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import styles from "./TempGoogleSheetsViewer.module.css";

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

  const resolvedSheets = useMemo(() => {
    if (sheets?.length) return sheets;
    return buildLegacySheets(sheetTitle, legacyValues);
  }, [sheetTitle, sheets, legacyValues]);

  useEffect(() => {
    if (open) {
      setInternalSheetIndex(0);
    }
  }, [open]);

  if (!open) return null;

  const currentSheetIndex = activeSheetIndex ?? internalSheetIndex;
  const setSheetIndex = onSheetChange ?? setInternalSheetIndex;

  const safeIndex = resolvedSheets.length
    ? Math.min(Math.max(currentSheetIndex, 0), resolvedSheets.length - 1)
    : 0;
  const activeSheet = resolvedSheets[safeIndex];
  const sheetValues = activeSheet?.values ?? [];
  const header = sheetValues[0] ?? [];
  const body = sheetValues.length > 1 ? sheetValues.slice(1) : [];
  const colCount = Math.max(header.length, ...body.map((row) => row.length), 0);

  const goPrev = () => setSheetIndex(Math.max(0, safeIndex - 1));
  const goNext = () => setSheetIndex(Math.min(resolvedSheets.length - 1, safeIndex + 1));

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
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden />
          </button>
        </div>

        {resolvedSheets.length > 1 ? (
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
              {resolvedSheets.map((sheet, index) => (
                <button
                  key={`${sheet.gid ?? sheet.title}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={index === safeIndex}
                  className={`${styles.sheetTab} ${index === safeIndex ? styles.sheetTabActive : ""}`}
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
              disabled={loading || safeIndex >= resolvedSheets.length - 1}
              aria-label="Следующий лист"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
            <span className={styles.sheetCounter}>
              {safeIndex + 1} / {resolvedSheets.length}
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
                  {sheetValues.length} строк · {colCount} кол.
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
                      <tr key={`r-${rowIndex}`}>
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
