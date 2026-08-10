/**
 * TEMP(Aveon) — подпись «Обновлено: …» под элементами синхронизации 1С.
 */
import styles from "./TempOnecSyncFreshness.module.css";
import {
  buildCombinedOnecFreshnessLabel,
  buildSpecsFreshnessLabel,
  buildStockFreshnessLabel,
  formatAveonDateTime,
  type ResourceSpecsStatus,
  type StockStatus,
} from "./onecSyncFreshness";

export function TempOnecSyncHint({
  stock,
  specs,
  loading,
}: {
  stock: StockStatus | null;
  specs: ResourceSpecsStatus | null;
  loading?: boolean;
}) {
  const failed =
    Boolean(stock?.status && stock.status !== "ok") ||
    Boolean(specs?.status && specs.status !== "ok");
  const text = buildCombinedOnecFreshnessLabel(stock, specs);
  const errorMessages = [stock?.error_message, specs?.error_message].filter(Boolean);

  return (
    <div className={styles.hintBlock} aria-live="polite">
      <p className={styles.hint}>
        <span className={failed ? styles.valueError : styles.value}>{loading ? "Загрузка…" : text}</span>
      </p>
      {failed && errorMessages.length ? (
        <p className={styles.errorDetail}>{errorMessages.join(" · ")}</p>
      ) : null}
    </div>
  );
}

export { formatAveonDateTime, buildStockFreshnessLabel, buildSpecsFreshnessLabel };
