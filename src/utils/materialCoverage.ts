import type {
  MaterialCoverageSource,
  ProcurementCaseSummary
} from "@/types/procurement";

export function materialCoverageLabel(
  sources: MaterialCoverageSource[] | null | undefined
): string {
  const values = new Set(sources || []);
  const hasSupplier = values.has("supplier_order") || values.has("mixed");
  const hasTransfer = values.has("transfer_order") || values.has("mixed");
  if (hasSupplier && hasTransfer) return "Закупка / перемещение";
  if (hasTransfer) return "Ведется перемещение";
  if (hasSupplier) return "Ведется закупка";
  return "Нет покрытия";
}

export function effectiveActualizedAt(
  item: Pick<
    ProcurementCaseSummary,
    "last_actualized_at" | "coverage_checked_at" | "updated_at"
  >
): string | null {
  return (
    item.last_actualized_at ||
    item.coverage_checked_at ||
    item.updated_at ||
    null
  );
}

export function coverageDocumentNumbers(
  supplierNumbers: string[] | null | undefined,
  transferNumbers: string[] | null | undefined
): string {
  const supplier = (supplierNumbers || []).filter(Boolean);
  const transfer = (transferNumbers || []).filter(Boolean);
  return [...supplier, ...transfer].join(" / ") || "—";
}
