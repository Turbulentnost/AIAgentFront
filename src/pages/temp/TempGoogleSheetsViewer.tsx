/**
 * TEMP(Aveon Google Sheets viewer) — удалить вместе с кнопкой на DocumentAnalysisAgent.
 */
import { Loader2, X } from "lucide-react";
import styles from "./TempGoogleSheetsViewer.module.css";

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  sheetTitle: string;
  spreadsheetTitle?: string | null;
  values: string[][];
  onClose: () => void;
};

export default function TempGoogleSheetsViewer({
  open,
  loading,
  error,
  sheetTitle,
  spreadsheetTitle,
  values,
  onClose,
}: Props) {
  if (!open) return null;

  const header = values[0] ?? [];
  const body = values.length > 1 ? values.slice(1) : [];
  const colCount = Math.max(header.length, ...body.map((row) => row.length), 0);

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
          <div>
            <h2 id="temp-google-sheets-title" className={styles.title}>
              {sheetTitle || "Google Sheets"}
            </h2>
            <p className={styles.meta}>
              {spreadsheetTitle ? `${spreadsheetTitle} · ` : ""}
              {loading ? "загрузка…" : `${values.length} строк`}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 className={styles.spinner} size={22} aria-hidden />
              <span>Загрузка листа «{sheetTitle}»…</span>
            </div>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : values.length === 0 ? (
            <p className={styles.empty}>Лист пуст.</p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
