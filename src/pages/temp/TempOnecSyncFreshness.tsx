/**
 * TEMP(Aveon) — подпись «Обновлено: …» под элементами синхронизации 1С.
 */
import styles from "./TempOnecSyncFreshness.module.css";
import {
  buildCombinedOnecFreshnessLabel,
  buildSpecsFreshnessLabel,
  buildStockFreshnessLabel,
  formatAveonDateTime,
  sanitizeOnecErrorMessage,
  type ProductionPlanStatus,
  type ResourceSpecsStatus,
  type StockStatus,
} from "./onecSyncFreshness";

export function TempOnecSyncHint({
  stock,
  specs,
  productionPlan,
  loading,
}: {
  stock: StockStatus | null;
  specs: ResourceSpecsStatus | null;
  productionPlan?: ProductionPlanStatus | null;
  loading?: boolean;
}) {
  const failed =
    Boolean(stock?.status && stock.status !== "ok") ||
    Boolean(specs?.status && specs.status !== "ok") ||
    Boolean(productionPlan?.status && productionPlan.status !== "ok");
  const text = buildCombinedOnecFreshnessLabel(stock, specs, productionPlan);
  const errorMessages = [stock?.error_message, specs?.error_message, productionPlan?.error_message]
    .filter(Boolean)
    .map((message) => sanitizeOnecErrorMessage(String(message)));

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
