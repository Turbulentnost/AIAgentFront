import { useMemo } from "react";
import { Loader2, X } from "lucide-react";
import type { ProductionPlanCache } from "./useAveonReferenceCache";
import styles from "./TempClearConsoleButton.module.css";

type Props = {
  open: boolean;
  loading: boolean;
  data: ProductionPlanCache | null;
  onClose: () => void;
};

function formatQty(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export default function TempYearProductionScheduleModal({ open, loading, data, onClose }: Props) {
  const yearView = data?.year_schedule_view ?? null;
  const products = yearView?.products ?? [];
  const monthKeys = yearView?.month_keys ?? [];
  const monthLabels = yearView?.month_labels ?? [];

  const error = useMemo(() => {
    if (loading) return null;
    if (!data?.ok) return data?.message || "Годовой график производства не найден в БД.";
    if (!products.length) return "Годовой график найден, но строк с изделиями нет.";
    return null;
  }, [data, loading, products.length]);

  if (!open) return null;

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
        aria-labelledby="year-production-schedule-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="year-production-schedule-title" className={styles.title}>
              График производства на год
            </h2>
            <p className={styles.meta}>
              {loading
                ? "загрузка…"
                : `${yearView?.year ?? data?.year ?? "—"} год · ${products.length} изделий · БД`}
            </p>
            {data?.source ? <p className={styles.meta}>Источник: {data.source}</p> : null}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.state}>
              <Loader2 className={styles.spinner} size={22} aria-hidden />
              <span>Читаю годовой график из БД…</span>
            </div>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : (
            <div className={styles.matrixWrap}>
              <table className={styles.matrix}>
                <thead>
                  <tr>
                    <th className={styles.stickyCol}>Изделие</th>
                    {monthKeys.map((monthKey, index) => (
                      <th key={monthKey} className={styles.qtyCol} title={monthKey}>
                        {monthLabels[index] ?? monthKey.slice(5, 7)}
                      </th>
                    ))}
                    <th className={styles.totalCol}>Σ</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.product_key}>
                      <th className={styles.stickyCol} scope="row">
                        <span className={styles.productName}>{product.name}</span>
                        {product.code ? <span className={styles.productCode}>{product.code}</span> : null}
                        {product.unit ? <span className={styles.productUnit}>{product.unit}</span> : null}
                      </th>
                      {monthKeys.map((monthKey) => {
                        const qty = product.qty_by_month[monthKey] ?? 0;
                        return (
                          <td
                            key={`${product.product_key}-${monthKey}`}
                            className={
                              qty > 0 ? `${styles.qtyCell} ${styles.qtyCellFilled}` : styles.qtyCell
                            }
                          >
                            {formatQty(qty)}
                          </td>
                        );
                      })}
                      <td className={styles.totalCell}>{formatQty(product.total)}</td>
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
