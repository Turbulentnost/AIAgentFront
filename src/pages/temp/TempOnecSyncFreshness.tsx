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
  manualSyncInProgress,
}: {
  stock: StockStatus | null;
  specs: ResourceSpecsStatus | null;
  productionPlan?: ProductionPlanStatus | null;
  loading?: boolean;
  manualSyncInProgress?: boolean;
}) {
  const failed =
    Boolean(stock?.status && stock.status !== "ok") ||
    Boolean(specs?.status && specs.status !== "ok") ||
    Boolean(productionPlan?.status && productionPlan.status !== "ok");
  const text = buildCombinedOnecFreshnessLabel(stock, specs, productionPlan);
  const errorMessages = [stock?.error_message, specs?.error_message, productionPlan?.error_message]
    .filter(Boolean)
    .map((message) => sanitizeOnecErrorMessage(String(message)));
  const statusText = loading
    ? manualSyncInProgress
      ? "Выгрузка из 1С…"
      : "Загрузка…"
    : text;

  return (
    <div className={styles.hintBlock} aria-live="polite">
      <p className={styles.hint}>
        <span className={failed ? styles.valueError : styles.value}>{statusText}</span>
      </p>
      {failed && errorMessages.length ? (
        <p className={styles.errorDetail}>{errorMessages.join(" · ")}</p>
      ) : null}
    </div>
  );
}

export { formatAveonDateTime, buildStockFreshnessLabel, buildSpecsFreshnessLabel };
