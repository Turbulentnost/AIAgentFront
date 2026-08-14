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

function formatHeaderDate(iso: string): string {
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

export default function TempProductionPlanModal({ open, loading, data, onClose }: Props) {
  const matrixView = data?.matrix_view ?? null;
  const header = data?.header ?? null;

  const defaultMonth = matrixView?.default_month ?? "";
  const activeMonth = defaultMonth;
  const activeMonthSource =
    activeMonth && data?.month_sources ? data.month_sources[activeMonth] : null;

  const activeMatrix = useMemo(() => {
    if (!matrixView || !activeMonth) return null;
    return matrixView.matrices[activeMonth] ?? null;
  }, [matrixView, activeMonth]);

  if (!open) return null;

  const productCount = activeMatrix?.products.length ?? 0;
  const error = data && !data.ok ? data.message || "Не удалось получить план производства." : null;

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
        aria-labelledby="temp-production-plan-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="temp-production-plan-title" className={styles.title}>
              План производства
            </h2>
            <p className={styles.meta}>
              {loading
                ? "загрузка…"
                : header
                  ? `${data?.year ? `${data.year} год · ` : ""}${productCount} изделий · документов: ${data?.documents_count ?? 1}`
                  : data?.message || "нет данных"}
            </p>
            {header ? (
              <p className={styles.meta}>
                Последний документ: №{header.number || "—"} от {formatHeaderDate(header.date)}
                {header.period_start && header.period_end
                  ? ` · период ${formatHeaderDate(header.period_start)} — ${formatHeaderDate(header.period_end)}`
                  : null}
              </p>
            ) : null}
            {data?.source ? <p className={styles.meta}>Источник: БД 1С · {data.source}</p> : null}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.state}>
              <Loader2 className={styles.spinner} size={22} aria-hidden />
              <span>Читаю план производства из БД…</span>
            </div>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : !activeMatrix || activeMatrix.products.length === 0 ? (
            <p className={styles.state}>План найден, но строк с изделиями нет.</p>
          ) : (
            <>
              {activeMatrix.month_label ? (
                <p className={styles.monthCaption}>{activeMatrix.month_label}</p>
              ) : null}

              {activeMonthSource?.number ? (
                <p className={styles.note}>
                  Источник месяца: №{activeMonthSource.number}
                  {activeMonthSource.date ? ` от ${formatHeaderDate(activeMonthSource.date)}` : ""}
                </p>
              ) : null}

              {activeMatrix.note ? <p className={styles.note}>{activeMatrix.note}</p> : null}

              <div className={styles.matrixWrap}>
                <table className={styles.matrix}>
                  <thead>
                    <tr>
                      <th className={styles.stickyCol}>Изделие</th>
                      {activeMatrix.date_keys.map((dateKey, index) => (
                        <th key={dateKey} className={styles.qtyCol} title={dateKey}>
                          {activeMatrix.date_labels[index] ?? dateKey}
                        </th>
                      ))}
                      {activeMatrix.has_undated ? <th className={styles.undatedCol}>Без даты</th> : null}
                      <th className={styles.totalCol}>Σ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMatrix.products.map((product) => (
                      <tr key={product.product_key}>
                        <th className={styles.stickyCol} scope="row">
                          <span className={styles.productName}>{product.name}</span>
                          {product.code ? <span className={styles.productCode}>{product.code}</span> : null}
                          {product.unit ? <span className={styles.productUnit}>{product.unit}</span> : null}
                        </th>
                        {activeMatrix.date_keys.map((dateKey) => {
                          const qty =
                            activeMatrix.granularity === "month"
                              ? product.month_only_qty
                              : product.qty_by_date[dateKey] ?? 0;
                          return (
                            <td
                              key={`${product.product_key}-${dateKey}`}
                              className={
                                qty > 0 ? `${styles.qtyCell} ${styles.qtyCellFilled}` : styles.qtyCell
                              }
                            >
                              {formatQty(qty)}
                            </td>
                          );
                        })}
                        {activeMatrix.has_undated ? (
                          <td className={styles.undatedCell}>{formatQty(product.month_only_qty)}</td>
                        ) : null}
                        <td className={styles.totalCell}>{formatQty(product.total)}</td>
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
