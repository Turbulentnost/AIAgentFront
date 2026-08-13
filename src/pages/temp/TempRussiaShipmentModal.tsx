import { Loader2, X } from "lucide-react";
import type { RussiaShipmentCache } from "./useAveonReferenceCache";
import styles from "./TempGoogleSheetsViewer.module.css";

type Props = {
  open: boolean;
  loading: boolean;
  data: RussiaShipmentCache | null;
  onClose: () => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TempRussiaShipmentModal({ open, loading, data, onClose }: Props) {
  if (!open) return null;

  const values = data?.values ?? [];
  const header = values[0] ?? [];
  const body = values.length > 1 ? values.slice(1) : [];
  const colCount = Math.max(header.length, ...body.map((row) => row.length), 0);
  const error = data && !data.ok ? data.error : null;

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
        aria-labelledby="temp-russia-shipment-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="temp-russia-shipment-title" className={styles.title}>
              График получения · Россия
            </h2>
            <p className={styles.meta}>
              {loading
                ? "загрузка…"
                : `${data?.fileName || "График"} · обновлён ${formatDate(data?.updatedAt)} · ${values.length} строк`}
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
              <span>Загружаю график России из БД…</span>
            </div>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : values.length === 0 ? (
            <p className={styles.empty}>График пуст.</p>
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
