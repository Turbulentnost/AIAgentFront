/**
 * TEMP — просмотр актуального плана производства из 1С (БД после синхронизации).
 */
import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { agentsApi } from "@/api/endpoints";
import styles from "./TempClearConsoleButton.module.css";

type ProductionPlanHeader = {
  ref_key: string;
  number: string;
  date: string;
  posted: boolean;
  deletion_mark: boolean;
};

type ProductionPlanProductRow = {
  product_key: string;
  name: string;
  code: string;
  unit: string;
  qty_by_date: Record<string, number>;
  month_only_qty: number;
  total: number;
};

type ProductionPlanMonthMatrix = {
  month_key: string;
  month_label: string;
  granularity: "day" | "month";
  date_keys: string[];
  date_labels: string[];
  has_undated: boolean;
  products: ProductionPlanProductRow[];
  note: string;
};

type ProductionPlanMatrixView = {
  month_keys: string[];
  default_month: string;
  matrices: Record<string, ProductionPlanMonthMatrix>;
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

export default function TempClearConsoleButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("");
  const [header, setHeader] = useState<ProductionPlanHeader | null>(null);
  const [matrixView, setMatrixView] = useState<ProductionPlanMatrixView | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");

  async function handleClick() {
    console.clear();
    setOpen(true);
    setLoading(true);
    setError(null);
    setMessage("");
    setHeader(null);
    setMatrixView(null);
    setSelectedMonth("");

    try {
      const result = await agentsApi.tempAveonProductionPlan();
      setMessage(result.message);
      setSource(result.source);
      setHeader(result.header);
      setMatrixView(result.matrix_view ?? null);
      setSelectedMonth(result.matrix_view?.default_month ?? "");
      if (!result.ok) {
        setError(result.message || "Не удалось получить план производства из 1С.");
      }
    } catch (caughtError) {
      console.error("[Aveon TEMP production plan] request failed", caughtError);
      setError("Не удалось получить план производства из 1С.");
    } finally {
      setLoading(false);
    }
  }

  const activeMatrix = useMemo(() => {
    if (!matrixView || !selectedMonth) return null;
    return matrixView.matrices[selectedMonth] ?? null;
  }, [matrixView, selectedMonth]);

  const productCount = activeMatrix?.products.length ?? 0;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        disabled={loading}
        onClick={() => void handleClick()}
      >
        {loading ? "Загрузка плана производства…" : "План производства (1С)"}
      </button>
      <p className={styles.hint}>
        Последний проведённый план из 1С (синхронизация в БД): изделия × даты месяца.
      </p>

      {open ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
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
                      ? `№${header.number || "—"} от ${formatHeaderDate(header.date)} · ${productCount} изделий`
                      : message || "нет данных"}
                </p>
                {source ? <p className={styles.meta}>Источник OData: {source}</p> : null}
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
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
                  {matrixView && matrixView.month_keys.length > 1 ? (
                    <div className={styles.monthTabs} role="tablist" aria-label="Месяц плана">
                      {matrixView.month_keys.map((monthKey) => {
                        const label =
                          matrixView.matrices[monthKey]?.month_label || monthKey;
                        return (
                          <button
                            key={monthKey}
                            type="button"
                            role="tab"
                            aria-selected={selectedMonth === monthKey}
                            className={
                              selectedMonth === monthKey
                                ? `${styles.monthTab} ${styles.monthTabActive}`
                                : styles.monthTab
                            }
                            onClick={() => setSelectedMonth(monthKey)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : activeMatrix.month_label ? (
                    <p className={styles.monthCaption}>{activeMatrix.month_label}</p>
                  ) : null}

                  {activeMatrix.note ? (
                    <p className={styles.note}>{activeMatrix.note}</p>
                  ) : null}

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
                          {activeMatrix.has_undated ? (
                            <th className={styles.undatedCol}>Без даты</th>
                          ) : null}
                          <th className={styles.totalCol}>Σ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMatrix.products.map((product) => (
                          <tr key={product.product_key}>
                            <th className={styles.stickyCol} scope="row">
                              <span className={styles.productName}>{product.name}</span>
                              {product.code ? (
                                <span className={styles.productCode}>{product.code}</span>
                              ) : null}
                              {product.unit ? (
                                <span className={styles.productUnit}>{product.unit}</span>
                              ) : null}
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
                              <td className={styles.undatedCell}>
                                {formatQty(product.month_only_qty)}
                              </td>
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
      ) : null}
    </div>
  );
}
