import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { procurementManagerApi } from "@/api/endpoints";
import {
  useAddProcurementShipmentEvent,
  useCaptureProcurementQuote,
  useCreateProcurementRecommendation,
  useCreateProcurementRfqDraft,
  useDownloadProcurementEstimate,
  useProcurementManagerAgentStatus,
  useProcurementManagerAllPositions,
  useProcurementManagerCase,
  useProcurementManagerComparison,
  useProcurementManagerDashboard,
  useProcurementManagerPermissions,
  useProcurementManagerPurchaseOrderDrafts,
  useProcurementManagerSuppliers,
  useProcurementManagerWorkspaceSummary,
  useReportProcurementNonconformity,
  useProcurementManagerStrategyStatus,
  useResumeProcurementAgent,
  useResumeProcurementStrategy,
  useRunProcurementAgent,
  useRunProcurementStrategy,
  useSearchProcurementSuppliers,
  useSubmitProcurementApproval,
  useSyncProcurementFrom1C,
  useUpdateProcurementLineAmounts
} from "@/hooks/useProcurementManager";
import { exportTableToExcel } from "@/utils/exportTableToExcel";
import type {
  AgentResumeAction,
  AgentStatus,
  ApprovalOperation,
  ApprovalRecord,
  LineAmountEntry,
  NomenclatureSupplierResult,
  OrderCoverageStatus,
  OrderCoverageTone,
  ProcurementManagerCaseDetail,
  ProcurementManagerCaseSummary,
  PurchaseOrderDraft,
  QuoteScore,
  StrategyResumeAction,
  StrategyStatus,
  Supplier,
  SupplierQuote,
  SupplierSearchResult,
  UsedSupplierPart
} from "@/types/procurementManager";
import type { ProcurementCasePosition } from "@/types/procurement";
import {
  caseTitle,
  formatDate,
  formatDateTime,
  formatQuantity
} from "@/utils/procurementDashboard";
import styles from "./ProcurementManagerAgent.module.css";

const AGENT_ID = "procurement_logistics_agent";
type Tab =
  | "suppliers"
  | "policy"
  | "estimate"
  | "quotes"
  | "rfq"
  | "order"
  | "delivery"
  | "audit";
type ConfirmAction =
  | { type: "supplier"; supplier: Supplier }
  | { type: "price"; score: QuoteScore }
  | { type: "rfq"; rfqId: string };

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "suppliers", label: "Поставщики" },
  { id: "policy", label: "Политика поставок" },
  { id: "estimate", label: "Смета" },
  { id: "quotes", label: "Сравнение КП" },
  { id: "rfq", label: "ЗКП" },
  { id: "order", label: "Заказ" },
  { id: "delivery", label: "Поставка" },
  { id: "audit", label: "HITL / Аудит" }
];

const WAVE_LABEL_RU: Record<string, string> = {
  critical: "критично",
  medium: "средне",
  late: "поздно",
  urgent: "срочно",
  economy: "экономия"
};

const SOURCE_BADGE_LABEL: Record<string, string> = {
  existing: "existing (банк)",
  internal: "internal",
  "1c": "1c",
  web: "web",
  procurement_supplier_mcp: "1c/mcp"
};

function sourceBadgeLabel(source: string): string {
  return SOURCE_BADGE_LABEL[source] || source;
}

function unwrapPurchaseOrderDrafts(
  raw: ProcurementManagerCaseDetail["purchase_order_drafts"] | PurchaseOrderDraft[] | undefined
): PurchaseOrderDraft[] {
  if (!raw?.length) return [];
  const out: PurchaseOrderDraft[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    if ("po_id" in item && "body" in item) {
      out.push(item as PurchaseOrderDraft);
      continue;
    }
    const nested = (item as { draft?: PurchaseOrderDraft | null }).draft;
    if (nested?.po_id) out.push(nested);
  }
  return out;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AgentHitlModal({
  status,
  pending,
  onClose,
  onResume
}: {
  status: AgentStatus | null | undefined;
  pending: boolean;
  onClose: () => void;
  onResume: (action: AgentResumeAction) => void;
}) {
  if (!status?.paused_for_human || !status.interrupt_type) return null;
  const isShortlist =
    status.interrupt_type === "procurement_shortlist_approval" ||
    status.interrupt_type.includes("shortlist") ||
    status.interrupt_type.includes("rfq");
  const isOrder =
    status.interrupt_type === "procurement_order_approval" ||
    status.interrupt_type.includes("order");
  if (!isShortlist && !isOrder) return null;
  const approveAction: AgentResumeAction = isOrder
    ? "approve_order_draft"
    : "approve_shortlist";
  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h3>
          {isOrder
            ? "Подтвердить черновик заказа?"
            : "Подтвердить shortlist / ЗКП?"}
        </h3>
        <p>
          {isOrder
            ? "Агент подготовил черновик заказа поставщику. Оплата и отправка в 1С запрещены."
            : "Агент собрал 1C/internal и web-кандидатов. Подтвердите shortlist — смета строится из доверенных + одобренного web."}
        </p>
        {isOrder && status.purchase_order_draft ? (
          <div className={styles.notice}>
            {status.purchase_order_draft.subject} · итого{" "}
            {status.purchase_order_draft.total} {status.purchase_order_draft.currency}
          </div>
        ) : null}
        {!isOrder && status.recommendation ? (
          <div className={styles.notice}>
            Рекомендация:{" "}
            {String(
              (status.recommendation as { supplier_name?: string }).supplier_name ||
                (status.recommendation as { supplier_id?: string }).supplier_id ||
                "—"
            )}
          </div>
        ) : null}
        <div className={styles.modalActions}>
          <button
            className={styles.secondary}
            disabled={pending}
            onClick={() => onResume("reject")}
            type="button"
          >
            Отклонить
          </button>
          <button
            className={styles.primary}
            disabled={pending}
            onClick={() => onResume(approveAction)}
            type="button"
          >
            {pending ? <Loader2 className={styles.spin} size={15} /> : <CheckCircle2 size={15} />}
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}

function StrategyHitlModal({
  status,
  pending,
  onClose,
  onResume
}: {
  status: StrategyStatus | null | undefined;
  pending: boolean;
  onClose: () => void;
  onResume: (action: StrategyResumeAction) => void;
}) {
  if (!status?.paused_for_human || !status.interrupt_type) return null;
  const interrupt = status.interrupt_type;
  const isPolicy =
    interrupt === "procurement_policy_approval" ||
    interrupt.includes("policy") ||
    interrupt.includes("shortlist");
  const isOrder =
    interrupt === "procurement_order_approval" || interrupt.includes("order");
  if (!isPolicy && !isOrder) return null;
  const approveAction: StrategyResumeAction = isOrder
    ? "approve_order_draft"
    : "approve_policy";
  const drafts = status.purchase_order_drafts ?? [];
  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h3>
          {isOrder
            ? "Подтвердить черновики заказов стратегии?"
            : "Подтвердить политику поставок?"}
        </h3>
        <p>
          {isOrder
            ? "Очередная стратегия подготовила черновики PO по поставщикам. Оплата и 1С запрещены."
            : "Подтвердите волны срочности и shortlist. Смета и PO строятся из доверенных + одобренного web."}
        </p>
        {isOrder && drafts.length ? (
          <div className={styles.notice}>
            Черновиков: {drafts.length}
            {drafts[0]?.subject ? ` · ${drafts[0].subject}` : ""}
          </div>
        ) : null}
        {!isOrder && status.explanation?.summary ? (
          <div className={styles.notice}>{String(status.explanation.summary)}</div>
        ) : null}
        <div className={styles.modalActions}>
          <button
            className={styles.secondary}
            disabled={pending}
            onClick={() => onResume("reject")}
            type="button"
          >
            Отклонить
          </button>
          <button
            className={styles.primary}
            disabled={pending}
            onClick={() => onResume(approveAction)}
            type="button"
          >
            {pending ? <Loader2 className={styles.spin} size={15} /> : <CheckCircle2 size={15} />}
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}

const COVERAGE_CASE_CLASS: Record<OrderCoverageTone, string> = {
  ready: styles.caseCoverageReady,
  attention: styles.caseCoverageAttention,
  uncovered: styles.caseCoverageUncovered
};

const COVERAGE_BADGE_CLASS: Record<OrderCoverageTone, string> = {
  ready: styles.badgeReady,
  attention: styles.badgeAttention,
  uncovered: styles.badgeUncovered
};

const key = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function normalizeQuote(quote: SupplierQuote): SupplierQuote {
  return {
    ...quote,
    lines: Array.isArray(quote.lines) ? quote.lines : []
  };
}

function unwrapQuotes(
  raw: ProcurementManagerCaseSummary["quotes"] | SupplierQuote[] | undefined
): SupplierQuote[] {
  if (!raw?.length) return [];
  const out: SupplierQuote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    if ("quote_id" in item) {
      out.push(normalizeQuote(item as SupplierQuote));
      continue;
    }
    const nested = (item as { quote?: SupplierQuote | null }).quote;
    if (nested?.quote_id) out.push(normalizeQuote(nested));
  }
  return out;
}

function activeSuppliersFromCase(item: ProcurementManagerCaseSummary): Supplier[] {
  const pm = (item.procurement_manager || {}) as { suppliers?: Supplier[] };
  const list = item.suppliers ?? pm.suppliers ?? [];
  return list.filter(
    (supplier) => Boolean(supplier?.supplier_id) && supplier.is_active !== false
  );
}

/** Earliest delivery deadline for an order (case-level or line-level). */
function orderRequiredDate(
  item: ProcurementManagerCaseSummary | ProcurementManagerCaseDetail
): string | null {
  const direct = item.required_date || item.deadline_at || null;
  const lineDates = (item.order_coverage?.lines ?? item.coverage?.lines ?? [])
    .map((line) => line.required_date)
    .filter((value): value is string => Boolean(value));
  if (!lineDates.length) return direct;
  const earliestLine = [...lineDates].sort((a, b) => a.localeCompare(b))[0] ?? null;
  if (!direct) return earliestLine;
  return earliestLine && earliestLine < direct ? earliestLine : direct;
}

function compareRequiredDateAsc(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  if (!left && !right) return 0;
  if (!left) return 1; // nulls last
  if (!right) return -1;
  return left.localeCompare(right);
}

function positionRequiredDate(
  position: ProcurementCasePosition,
  caseRequired?: string | null
): string | null {
  return position.required_date || caseRequired || null;
}

/** Покрытие из банка/аллокации по срокам; fallback — КП/поставщики кейса. */
function deriveOrderCoverage(
  item: ProcurementManagerCaseSummary | ProcurementManagerCaseDetail
): OrderCoverageStatus {
  const summaryItem = item as ProcurementManagerCaseSummary;
  const server =
    item.order_coverage ??
    item.coverage ??
    (
      summaryItem.procurement_manager as
        | { order_coverage?: OrderCoverageStatus }
        | null
        | undefined
    )?.order_coverage;
  if (server?.tone && server.label) {
    return {
      tone: server.tone,
      label: server.label,
      covered_count: Number(server.covered_count) || 0,
      positions_count: Number(server.positions_count) || 0,
      uncovered_positions_count: Number(server.uncovered_positions_count) || 0,
      has_suppliers: Boolean(server.has_suppliers),
      lines: server.lines,
      needed_quantity: server.needed_quantity,
      covered_quantity: server.covered_quantity,
      deficit_quantity: server.deficit_quantity
    };
  }

  // Derive from bank allocation lines when tone wrapper is missing.
  const bankLines = server?.lines ?? [];
  if (bankLines.length > 0) {
    const positionsCount = bankLines.length;
    const uncoveredCount = bankLines.filter((line) => line.tone === "uncovered").length;
    const coveredCount = positionsCount - uncoveredCount;
    const coveredQty = bankLines.reduce(
      (sum, line) => sum + (toFiniteNumber(line.covered_quantity) ?? 0),
      0
    );
    const neededQty = bankLines.reduce(
      (sum, line) => sum + (toFiniteNumber(line.needed_quantity) ?? 0),
      0
    );
    let tone: OrderCoverageStatus["tone"] = "attention";
    let label = "Требуют внимания";
    if (uncoveredCount === positionsCount || coveredQty <= 0) {
      tone = "uncovered";
      label = "Полностью необеспечен";
    } else if (uncoveredCount === 0 && coveredQty + 1e-6 >= neededQty) {
      tone = "ready";
      label = "Готов";
    }
    return {
      tone,
      label,
      covered_count: coveredCount,
      positions_count: positionsCount,
      uncovered_positions_count: uncoveredCount,
      has_suppliers: bankLines.some(
        (line) =>
          (toFiniteNumber(line.from_supplier) ?? 0) > 0 ||
          line.coverage_source === "supplier" ||
          line.coverage_source === "mixed"
      ),
      lines: bankLines,
      needed_quantity: server?.needed_quantity,
      covered_quantity: server?.covered_quantity,
      deficit_quantity: server?.deficit_quantity
    };
  }

  const pm = (summaryItem.procurement_manager || {}) as {
    quotes?: ProcurementManagerCaseSummary["quotes"];
    recommendation?: ProcurementManagerCaseSummary["recommendation"];
  };
  const suppliers = activeSuppliersFromCase(summaryItem);
  const hasSuppliers = suppliers.length > 0;
  const quotes = unwrapQuotes(summaryItem.quotes ?? pm.quotes);
  const coveredIds = new Set<string>();
  for (const quote of quotes) {
    for (const line of quote.lines ?? []) {
      const lineId = String(line.line_id || "").trim();
      if (lineId) coveredIds.add(lineId);
    }
  }
  const recommendation =
    (item as ProcurementManagerCaseSummary).recommendation ?? pm.recommendation ?? null;
  const hasRecommendation = Boolean(recommendation?.supplier_id);
  const positionsCount = Math.max(
    0,
    Number((item as ProcurementManagerCaseSummary).positions_count) ||
      (item as ProcurementManagerCaseDetail).positions?.length ||
      0
  );
  const coveredCount = coveredIds.size;
  const fullyCovered =
    positionsCount > 0 &&
    (coveredCount >= positionsCount || (hasRecommendation && hasSuppliers));

  if (positionsCount === 0) {
    return hasSuppliers
      ? {
          tone: "ready",
          label: "Готов",
          covered_count: 0,
          positions_count: 0,
          has_suppliers: true
        }
      : {
          tone: "uncovered",
          label: "Полностью необеспечен",
          covered_count: 0,
          positions_count: 0,
          has_suppliers: false
        };
  }

  // No bank coverage payload: absence of RFQ suppliers must NOT mean
  // «Полностью необеспечен» — warehouse/bank cover is computed server-side.
  if (!hasSuppliers && coveredCount === 0) {
    return {
      tone: "attention",
      label: "Требуют внимания",
      covered_count: 0,
      positions_count: positionsCount,
      has_suppliers: false
    };
  }

  if (fullyCovered) {
    return {
      tone: "ready",
      label: "Готов",
      covered_count: Math.max(coveredCount, positionsCount),
      positions_count: positionsCount,
      has_suppliers: hasSuppliers
    };
  }

  return {
    tone: "attention",
    label: "Требуют внимания",
    covered_count: coveredCount,
    positions_count: positionsCount,
    has_suppliers: hasSuppliers
  };
}

function parseDraftNumber(raw: string | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Positive finite price only — 0/empty must not block PO/quote fallbacks. */
function positiveUnitPrice(value: unknown): number | null {
  const num = toFiniteNumber(value as string | number | null | undefined);
  return num != null && num > 0 ? num : null;
}

function storedUnitPrice(
  position: ProcurementCasePosition,
  stored: LineAmountEntry | undefined
): number | null {
  const fromUnit = positiveUnitPrice(stored?.unit_price);
  if (fromUnit != null) return fromUnit;
  const amount = toFiniteNumber(stored?.amount);
  if (amount != null && amount > 0) {
    const qty = Number(position.quantity);
    if (Number.isFinite(qty) && qty > 0) return amount / qty;
  }
  return null;
}

function poUnitPricesByLine(drafts: PurchaseOrderDraft[]): Map<string, number> {
  const prices = new Map<string, number>();
  for (const draft of drafts) {
    for (const line of draft.lines ?? []) {
      const price = positiveUnitPrice(line.unit_price);
      if (price == null || !line.line_id || prices.has(line.line_id)) continue;
      prices.set(line.line_id, price);
    }
  }
  return prices;
}

function poSuppliersByLine(drafts: PurchaseOrderDraft[]): Map<string, UsedSupplierPart[]> {
  const map = new Map<string, UsedSupplierPart[]>();
  for (const draft of drafts) {
    const supplierId = draft.supplier_id?.trim();
    if (!supplierId) continue;
    for (const line of draft.lines ?? []) {
      const qty = toFiniteNumber(line.quantity) ?? 0;
      if (!line.line_id || qty <= 0) continue;
      const parts = map.get(line.line_id) ?? [];
      if (!parts.some((part) => part.supplier_id === supplierId)) {
        parts.push({
          supplier_id: supplierId,
          supplier_name: draft.supplier_name || supplierId,
          quantity: line.quantity
        });
      }
      map.set(line.line_id, parts);
    }
  }
  return map;
}

function quoteSuppliersByLine(
  quotes: SupplierQuote[],
  supplierById: Map<string, Supplier>
): Map<string, UsedSupplierPart[]> {
  const map = new Map<string, UsedSupplierPart[]>();
  for (const quote of quotes) {
    const supplierId = quote.supplier_id?.trim();
    if (!supplierId) continue;
    const supplierName =
      supplierById.get(supplierId)?.name || quote.supplier_id || supplierId;
    for (const line of quote.lines ?? []) {
      const qty = toFiniteNumber(line.quantity) ?? 0;
      const price = positiveUnitPrice(line.unit_price);
      if (!line.line_id || qty <= 0 || price == null) continue;
      const parts = map.get(line.line_id) ?? [];
      if (!parts.some((part) => part.supplier_id === supplierId)) {
        parts.push({
          supplier_id: supplierId,
          supplier_name: supplierName,
          quantity: line.quantity
        });
      }
      map.set(line.line_id, parts);
    }
  }
  return map;
}

function mutationError(mutations: Array<{ error: unknown }>) {
  const error = mutations.find((item) => item.error)?.error as
    | {
        response?: {
          status?: number;
          data?: { detail?: string | Array<{ msg?: string }> };
        };
        message?: string;
        code?: string;
      }
    | undefined;
  if (!error) return null;
  const detail = error.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    if (error.response?.status === 404 && /not found/i.test(detail)) {
      return (
        "Маршрут агента поиска/оценки недоступен (404). Нужен локальный AIAgentBack " +
        "с /cases/{id}/agent/run (сейчас: VITE_API_PROXY / VITE_API_SERVER). " +
        "Офисный :5454 и чужой фронт на :5173 этих маршрутов не имеют — откройте AIAgentFront на :5174."
      );
    }
    // Legacy backend mapped KeyError('request') → 404 detail "'request'" after MemorySaver loss.
    if (/^'request'$/.test(detail.trim())) {
      return (
        "Состояние HITL агента потеряно после перезапуска сервера. " +
        "Обновите страницу и подтвердите снова (или перезапустите агента)."
      );
    }
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item?.msg).filter(Boolean);
    if (messages.length) return messages.join("; ");
  }
  if (error.code === "ECONNABORTED") {
    return "Превышено время ожидания запуска агента. Попробуйте ещё раз.";
  }
  if (error.response?.status === 403) {
    return "Нет доступа к рабочему месту менеджера по закупкам.";
  }
  return error.message || "Не удалось выполнить операцию";
}

function averageRating(supplier: Supplier): number | null {
  const parts = [
    Number(supplier.quality_rating),
    Number(supplier.delivery_rating),
    Number(supplier.commercial_rating)
  ].filter((value) => Number.isFinite(value) && value > 0);
  if (!parts.length) return null;
  return Math.round((parts.reduce((sum, value) => sum + value, 0) / parts.length) * 100) / 100;
}

function formatMoney(value: number | null | undefined, currency = "RUB") {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} ${currency}`;
}

function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function formatPriceRange(
  priceMin: string | number | null | undefined,
  priceMax: string | number | null | undefined
) {
  const min = toFiniteNumber(priceMin);
  const max = toFiniteNumber(priceMax);
  if (min == null && max == null) return "—";
  if (min != null && max != null) {
    if (min === max) {
      return min.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
    }
    return `${min.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} – ${max.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`;
  }
  const single = min ?? max;
  return single == null
    ? "—"
    : single.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

/** Allocation-used suppliers only (warehouse → empty; no bank top-N fallback). */
function usedSuppliersFromCoverage(
  cov:
    | Pick<
        NonNullable<OrderCoverageStatus["lines"]>[number],
        "coverage_source" | "from_supplier" | "supplier_parts" | "used_suppliers"
      >
    | null
    | undefined
): UsedSupplierPart[] {
  if (!cov) return [];
  if (cov.coverage_source === "warehouse") return [];
  const fromSupplier = toFiniteNumber(cov.from_supplier) ?? 0;
  if (fromSupplier <= 0) return [];
  const raw = cov.used_suppliers?.length ? cov.used_suppliers : cov.supplier_parts ?? [];
  return raw
    .filter((part) => {
      const qty = toFiniteNumber(part.quantity) ?? 0;
      return Boolean(part.supplier_id) && qty > 0;
    })
    .map((part) => ({
      supplier_id: part.supplier_id,
      supplier_name: part.supplier_name || part.supplier_id,
      quantity: part.quantity
    }));
}

type CoverageSourceDisplay = {
  coverage_source?: string | null;
  coverage_source_label?: string | null;
  from_warehouse?: string | number | null;
  from_supplier?: string | number | null;
};

const COVERAGE_SOURCE_LABEL_RU: Record<string, string> = {
  warehouse: "склад",
  supplier: "поставщик",
  mixed: "смешанный",
  none: "нет"
};

/** Mixed: «смешанный · Склад: 25 · Закупка: 75»; other sources keep short label. */
function formatCoverageSourceText(
  cov: CoverageSourceDisplay | null | undefined,
  fallback = "—"
): string {
  if (!cov) return fallback;
  const base =
    cov.coverage_source_label ||
    COVERAGE_SOURCE_LABEL_RU[cov.coverage_source ?? ""] ||
    fallback;
  if (cov.coverage_source !== "mixed") return base || fallback;
  const fromWh = toFiniteNumber(cov.from_warehouse) ?? 0;
  const fromSp = toFiniteNumber(cov.from_supplier) ?? 0;
  return `${base} · Склад: ${formatQuantity(String(fromWh))} · Закупка: ${formatQuantity(String(fromSp))}`;
}

function CoverageSourceCell({
  cov,
  fallback = "—"
}: {
  cov: CoverageSourceDisplay | null | undefined;
  fallback?: string;
}) {
  if (!cov) return <>{fallback}</>;
  const base =
    cov.coverage_source_label ||
    COVERAGE_SOURCE_LABEL_RU[cov.coverage_source ?? ""] ||
    fallback;
  if (cov.coverage_source !== "mixed") return <>{base || fallback}</>;
  const fromWh = toFiniteNumber(cov.from_warehouse) ?? 0;
  const fromSp = toFiniteNumber(cov.from_supplier) ?? 0;
  return (
    <>
      {base || "смешанный"}
      <br />
      <small className={styles.muted}>
        Склад: {formatQuantity(String(fromWh))} · Закупка:{" "}
        {formatQuantity(String(fromSp))}
      </small>
    </>
  );
}

function UsedSuppliersBlock({ parts }: { parts: UsedSupplierPart[] }) {
  if (!parts.length) return null;
  return (
    <ul className={styles.usedSuppliers}>
      {parts.map((part) => (
        <li key={part.supplier_id}>
          <strong>{part.supplier_name}</strong>
          <span className={styles.muted}>
            {formatQuantity(String(part.quantity))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ConfirmDialog({
  action,
  isSuperuser,
  pending,
  onCancel,
  onConfirm
}: {
  action: ConfirmAction | null;
  isSuperuser: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!action) return null;
  const label =
    action.type === "supplier"
      ? `выбор поставщика «${action.supplier.name}»`
      : action.type === "price"
        ? `цену предложения ${action.score.quote_id}`
        : `передачу черновика ЗКП ${action.rfqId} в контур отправки`;
  return (
    <div className={styles.modalOverlay} onClick={onCancel} role="presentation">
      <div
        aria-modal="true"
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h3>{isSuperuser ? "Зафиксировать согласование?" : "Запросить согласование?"}</h3>
        <p>
          Вы подтверждаете {label}.{" "}
          {isSuperuser
            ? "Будет создана одобренная запись от имени уполномоченного пользователя."
            : "Будет создан запрос; решение должен принять уполномоченный пользователь."}
        </p>
        <div className={styles.notice}>
          <ShieldCheck size={17} /> Отправка, заказ и платёж этим действием не выполняются
        </div>
        <div className={styles.modalActions}>
          <button className={styles.secondary} disabled={pending} onClick={onCancel} type="button">
            Отмена
          </button>
          <button className={styles.primary} disabled={pending} onClick={onConfirm} type="button">
            {pending ? <Loader2 className={styles.spin} size={15} /> : <CheckCircle2 size={15} />}
            {isSuperuser ? "Одобрить" : "Запросить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProcurementManagerAgent() {
  const { user } = useAuth();
  const isSuperuser = user?.is_superuser ?? false;
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("suppliers");
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [supplierApproval, setSupplierApproval] = useState<{
    supplierId: string;
    approvalId: string;
  } | null>(null);
  const [searchInfo, setSearchInfo] = useState<{
    query: string;
    sources: string[];
    web: boolean;
    nomenclatureResults?: NomenclatureSupplierResult[];
  } | null>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [showAllPositions, setShowAllPositions] = useState(false);

  const permissions = useProcurementManagerPermissions();
  const canAccess = permissions.data?.accessible_role_agents?.includes(AGENT_ID) ?? false;
  const dashboard = useProcurementManagerDashboard(canAccess);
  const summary = useProcurementManagerWorkspaceSummary(canAccess);
  const allPositions = useProcurementManagerAllPositions(canAccess && showAllPositions);
  const cases = useMemo(() => {
    const list = (dashboard.data?.groups.flatMap((group) => group.cases) ??
      []) as ProcurementManagerCaseSummary[];
    // Urgency: earliest required_date first; missing dates last.
    return [...list].sort((a, b) =>
      compareRequiredDateAsc(orderRequiredDate(a), orderRequiredDate(b))
    );
  }, [dashboard.data]);
  const caseId = params.get("case") || "";
  const detail = useProcurementManagerCase(caseId || null, canAccess);
  const suppliersQuery = useProcurementManagerSuppliers(caseId || null, canAccess);
  const comparisonQuery = useProcurementManagerComparison(caseId || null, canAccess);
  const agentStatusQuery = useProcurementManagerAgentStatus(caseId || null, canAccess);
  const poDraftsQuery = useProcurementManagerPurchaseOrderDrafts(caseId || null, canAccess);
  const strategyStatusQuery = useProcurementManagerStrategyStatus(canAccess);

  const searchSuppliers = useSearchProcurementSuppliers();
  const createRfq = useCreateProcurementRfqDraft();
  const captureQuote = useCaptureProcurementQuote();
  const recommendation = useCreateProcurementRecommendation();
  const approval = useSubmitProcurementApproval();
  const shipment = useAddProcurementShipmentEvent();
  const nonconformity = useReportProcurementNonconformity();
  const updateAmounts = useUpdateProcurementLineAmounts();
  const syncFrom1C = useSyncProcurementFrom1C();
  const downloadEstimate = useDownloadProcurementEstimate();
  const runAgent = useRunProcurementAgent();
  const resumeAgent = useResumeProcurementAgent();
  const runStrategy = useRunProcurementStrategy();
  const resumeStrategy = useResumeProcurementStrategy();
  const [hitlOpen, setHitlOpen] = useState(true);
  const [strategyHitlOpen, setStrategyHitlOpen] = useState(true);

  useEffect(() => {
    if (cases.length && !cases.some((item) => item.id === caseId)) {
      setParams({ case: cases[0].id }, { replace: true });
    }
  }, [caseId, cases, setParams]);

  useEffect(() => {
    setSelectedSupplierIds([]);
    setSupplierApproval(null);
    setSearchInfo(null);
    setDraftPrices({});
    setSyncNotice(null);
    setHitlOpen(true);
  }, [caseId]);

  const workspace = detail.data;
  const suppliers = suppliersQuery.data ?? workspace?.suppliers ?? [];
  const nomenclatureResults = useMemo(() => {
    const fromSearch = searchInfo?.nomenclatureResults;
    if (fromSearch?.length) return fromSearch;
    const fromWorkspace = workspace?.nomenclature_results;
    if (fromWorkspace?.length) return fromWorkspace;
    const latestSearch = workspace?.supplier_searches?.length
      ? workspace.supplier_searches[workspace.supplier_searches.length - 1]
      : null;
    if (latestSearch?.nomenclature_results?.length) {
      return latestSearch.nomenclature_results;
    }
    return [] as NomenclatureSupplierResult[];
  }, [searchInfo?.nomenclatureResults, workspace?.nomenclature_results, workspace?.supplier_searches]);
  const comparison = comparisonQuery.data ?? workspace?.comparison;
  // Backend/summary payloads sometimes omit quote.lines — unwrap before render.
  const quotes = useMemo(() => unwrapQuotes(workspace?.quotes), [workspace?.quotes]);
  const quoteById = useMemo(
    () => new Map(quotes.map((quote) => [quote.quote_id, quote])),
    [quotes]
  );
  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.supplier_id, supplier])),
    [suppliers]
  );
  const agentStatus = agentStatusQuery.data;
  const strategyStatus = strategyStatusQuery.data;
  useEffect(() => {
    if (strategyStatus?.paused_for_human) setStrategyHitlOpen(true);
  }, [strategyStatus?.paused_for_human, strategyStatus?.interrupt_type]);
  const poDrafts = useMemo(
    () => unwrapPurchaseOrderDrafts(poDraftsQuery.data ?? workspace?.purchase_order_drafts),
    [poDraftsQuery.data, workspace?.purchase_order_drafts]
  );
  const topSuppliersPreview =
    agentStatus?.evaluation?.lines?.[0]?.top_suppliers?.slice(0, 3) ??
    workspace?.evaluation?.lines?.[0]?.top_suppliers?.slice(0, 3) ??
    [];

  const quoteUnitPrices = useMemo(() => {
    const prices = new Map<string, number>();
    for (const quote of quotes) {
      for (const line of quote.lines ?? []) {
        const price = positiveUnitPrice(line.unit_price);
        if (price != null && !prices.has(line.line_id)) {
          prices.set(line.line_id, price);
        }
      }
    }
    return prices;
  }, [quotes]);

  const poUnitPrices = useMemo(() => poUnitPricesByLine(poDrafts), [poDrafts]);
  const poSuppliers = useMemo(() => poSuppliersByLine(poDrafts), [poDrafts]);
  const quoteSuppliers = useMemo(
    () => quoteSuppliersByLine(quotes, supplierById),
    [quotes, supplierById]
  );

  const positions = useMemo(() => {
    // Only the selected case's lines — never reuse another case's workspace payload.
    if (!workspace || !caseId || workspace.id !== caseId) return [];
    return (workspace.positions ?? []).filter((item) => !item.cancelled);
  }, [caseId, workspace]);

  useEffect(() => {
    if (!workspace || workspace.id !== caseId) return;
    const coverageByLine = new Map(
      (workspace.order_coverage?.lines ?? []).map((line) => [line.line_id, line])
    );
    const next: Record<string, string> = {};
    for (const position of workspace.positions ?? []) {
      if (position.cancelled) continue;
      // Warehouse lines are not purchased — keep price empty, sum stays 0.
      if (coverageByLine.get(position.line_id)?.coverage_source === "warehouse") {
        continue;
      }
      const price =
        storedUnitPrice(position, workspace.line_amounts?.[position.line_id]) ??
        poUnitPrices.get(position.line_id) ??
        quoteUnitPrices.get(position.line_id) ??
        null;
      if (price != null) next[position.line_id] = String(price);
    }
    setDraftPrices(next);
  }, [caseId, poUnitPrices, quoteUnitPrices, workspace]);

  const lineRows = useMemo(() => {
    const coverageByLine = new Map(
      (workspace?.order_coverage?.lines ?? []).map((line) => [line.line_id, line])
    );
    return positions.map((position) => {
      const qty = Number(position.quantity);
      const hasDraft = Object.prototype.hasOwnProperty.call(draftPrices, position.line_id);
      const manualPrice = hasDraft ? parseDraftNumber(draftPrices[position.line_id]) : null;
      const poPrice = poUnitPrices.get(position.line_id) ?? null;
      const quotePrice = quoteUnitPrices.get(position.line_id) ?? null;
      // Manual input wins; otherwise prefer PO draft mapping, then КП.
      const unitPrice = hasDraft
        ? manualPrice
        : (poPrice ?? quotePrice);
      const cov = coverageByLine.get(position.line_id);
      const coverageSource = cov?.coverage_source ?? null;
      const fromSupplier = toFiniteNumber(cov?.from_supplier) ?? 0;
      const billablePrice = positiveUnitPrice(unitPrice);
      let amount: number | null =
        billablePrice != null && Number.isFinite(qty) ? billablePrice * qty : null;
      // Warehouse stock is not purchased; mixed bills only supplier-covered qty.
      if (coverageSource === "warehouse") {
        amount = 0;
      } else if (
        coverageSource === "mixed" &&
        billablePrice != null &&
        Number.isFinite(fromSupplier)
      ) {
        amount = billablePrice * fromSupplier;
      }
      const source =
        coverageSource === "warehouse"
          ? "склад"
          : hasDraft && manualPrice != null
            ? "вручную"
            : poPrice != null
              ? "PO"
              : quotePrice != null
                ? "КП"
                : "—";
      return {
        position,
        qty,
        amount,
        unitPrice: coverageSource === "warehouse" ? null : unitPrice,
        source,
        currency: workspace?.line_amounts?.[position.line_id]?.currency || workspace?.currency || "RUB"
      };
    });
  }, [
    draftPrices,
    poUnitPrices,
    positions,
    quoteUnitPrices,
    workspace?.currency,
    workspace?.line_amounts,
    workspace?.order_coverage?.lines
  ]);

  const totalAmount = useMemo(
    () => lineRows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    [lineRows]
  );

  const aggregatedRows = useMemo(() => {
    if (!showAllPositions) return [];
    return (allPositions.data?.rows ?? []).map((row, index) => {
      const quantity = toFiniteNumber(row.quantity) ?? 0;
      const amount = toFiniteNumber(row.estimated_amount ?? row.amount);
      const priceMin = toFiniteNumber(row.price_min);
      const priceMax = toFiniteNumber(row.price_max);
      const avgUnitPrice = toFiniteNumber(row.avg_unit_price);
      const overpay = toFiniteNumber(row.overpay);
      return {
        key: row.nomenclature_id || `row-${index}`,
        nomenclature_id: row.nomenclature_id || "",
        nomenclature_name:
          row.nomenclature_name || row.nomenclature_id || "Без названия",
        quantity,
        unit: row.unit || "шт",
        priceMin,
        priceMax,
        avgUnitPrice,
        amount,
        overpay,
        currency: row.currency || "RUB",
        source: row.amount_source || "—",
        coverageSource: formatCoverageSourceText(row),
        coverageSourceMeta: {
          coverage_source: row.coverage_source,
          coverage_source_label: row.coverage_source_label,
          from_warehouse: row.from_warehouse,
          from_supplier: row.from_supplier
        },
        amountFormula: row.amount_formula || allPositions.data?.amount_formula || "",
        hasManualOverride: Boolean(row.has_manual_override),
        usedSuppliers:
          row.coverage_source === "warehouse"
            ? []
            : (row.used_suppliers?.length
                ? row.used_suppliers
                : row.supplier_parts ?? []
              ).filter((part) => (toFiniteNumber(part.quantity) ?? 0) > 0),
        requiredDate: row.required_date
          ? String(row.required_date).slice(0, 10)
          : null
      };
    });
  }, [allPositions.data, showAllPositions]);

  const aggregatedTotal = useMemo(() => {
    const fromApi = toFiniteNumber(allPositions.data?.total_estimated_amount);
    if (fromApi != null) return fromApi;
    return aggregatedRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  }, [aggregatedRows, allPositions.data?.total_estimated_amount]);

  const amountFormulaHint =
    allPositions.data?.amount_formula ||
    "Сумма = дозакупка у поставщиков: склад → 0; жадное покрытие по unit_price с учётом лота/min_order. Средняя цена = сумма / кол-во потребности. Переплата = стоимость избытка сверх need (отдельно). Цена min–max — справочно.";

  const coverageByLineId = useMemo(() => {
    const map = new Map<string, NonNullable<OrderCoverageStatus["lines"]>[number]>();
    for (const item of cases) {
      const lines = item.order_coverage?.lines ?? [];
      for (const line of lines) {
        map.set(`${line.case_id}:${line.line_id}`, line);
      }
    }
    if (workspace?.order_coverage?.lines) {
      for (const line of workspace.order_coverage.lines) {
        map.set(`${line.case_id}:${line.line_id}`, line);
      }
    }
    return map;
  }, [cases, workspace]);

  const rfqLines = positions
    .filter((position) => Number(position.quantity) > 0)
    .map((position) => ({
      line_id: position.line_id || position.id,
      nomenclature_id: position.nomenclature_id || undefined,
      description:
        position.nomenclature_name || position.nomenclature_id || `Позиция ${position.line_number}`,
      quantity: Number(position.quantity),
      unit: position.unit || "шт",
      required_date: position.required_date?.slice(0, 10) || undefined
    }));

  const latestRecordShipmentApproval = [...(workspace?.approvals ?? [])]
    .reverse()
    .find((item) => item.operation === "record_shipment" && item.status === "approved");

  const error = mutationError([
    searchSuppliers,
    createRfq,
    captureQuote,
    recommendation,
    approval,
    shipment,
    nonconformity,
    updateAmounts,
    syncFrom1C,
    downloadEstimate,
    runAgent,
    resumeAgent,
    runStrategy,
    resumeStrategy
  ]);

  const toggleSupplier = (supplierId: string) =>
    setSelectedSupplierIds((current) =>
      current.includes(supplierId)
        ? current.filter((item) => item !== supplierId)
        : [...current, supplierId]
    );

  const recordApproval = (
    operation: ApprovalOperation,
    comment: string,
    onSuccess?: (record: ApprovalRecord) => void
  ) => {
    approval.mutate(
      {
        caseId,
        payload: {
          operation,
          status: isSuperuser ? "approved" : "requested",
          comment,
          idempotency_key: key(`approval-${operation}`)
        }
      },
      { onSuccess }
    );
  };

  const confirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "supplier") {
      const supplier = confirmAction.supplier;
      recordApproval(
        "select_supplier",
        `Поставщик: ${supplier.name} (${supplier.supplier_id})`,
        (record) => {
          if (record.status === "approved") {
            setSupplierApproval({ supplierId: supplier.supplier_id, approvalId: record.approval_id });
          }
          setConfirmAction(null);
        }
      );
      return;
    }
    if (confirmAction.type === "rfq") {
      recordApproval(
        "send_rfq",
        `Черновик ЗКП: ${confirmAction.rfqId}. Только согласование, без отправки.`,
        () => setConfirmAction(null)
      );
      return;
    }
    const score = confirmAction.score;
    recordApproval(
      "approve_price",
      `КП: ${score.quote_id}, поставщик: ${score.supplier_id}`,
      (priceRecord) => {
        setConfirmAction(null);
        if (!isSuperuser || priceRecord.status !== "approved") return;
        const selected =
          supplierApproval?.supplierId === score.supplier_id ? supplierApproval : null;
        if (!selected) return;
        recommendation.mutate({
          caseId,
          payload: {
            supplier_id: score.supplier_id,
            quote_id: score.quote_id,
            rationale: "Поставщик и цена одобрены уполномоченным пользователем",
            supplier_selection_approval_id: selected.approvalId,
            price_approval_id: priceRecord.approval_id,
            idempotency_key: key("recommendation")
          }
        });
      }
    );
  };

  const submitQuote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const position = workspace?.positions.find((item) => item.line_id === String(data.get("line_id")));
    if (!position) return;
    captureQuote.mutate(
      {
        caseId,
        payload: {
          quote: {
            quote_id: key("quote"),
            supplier_id: String(data.get("supplier_id")),
            rfq_id: String(data.get("rfq_id") || "") || undefined,
            currency: String(data.get("currency") || "RUB").toUpperCase(),
            lines: [
              {
                line_id: position.line_id,
                unit_price: Number(data.get("unit_price")),
                quantity: Number(data.get("quantity")),
                delivery_days: Number(data.get("delivery_days")),
                compliant: data.get("compliant") === "on"
              }
            ],
            valid_until: String(data.get("valid_until") || "") || undefined,
            payment_terms: String(data.get("payment_terms") || "") || undefined,
            warranty_months: Number(data.get("warranty_months") || 0),
            quality_score: Number(data.get("quality_score") || 50),
            risk_score: Number(data.get("risk_score") || 0),
            received_at: new Date().toISOString()
          },
          idempotency_key: key("quote-submit")
        }
      },
      { onSuccess: () => form.reset() }
    );
  };

  const saveAmounts = async () => {
    if (showAllPositions) return;
    if (!caseId || !workspace) return;
    const lines: LineAmountEntry[] = positions.map((position) => {
      const qty = Number(position.quantity);
      const unitPrice = Object.prototype.hasOwnProperty.call(draftPrices, position.line_id)
        ? parseDraftNumber(draftPrices[position.line_id])
        : null;
      const amount =
        unitPrice != null && Number.isFinite(qty) ? unitPrice * qty : null;
      return {
        line_id: position.line_id,
        unit_price: unitPrice,
        amount,
        currency: workspace.currency || "RUB"
      };
    });
    updateAmounts.mutate({
      caseId,
      payload: { lines, idempotency_key: key("line-amounts") }
    });
  };

  const handleSync = () => {
    syncFrom1C.mutate(undefined, {
      onSuccess: (result) => {
        const message =
          typeof result.summary?.message === "string"
            ? result.summary.message
            : result.mode === "poll"
              ? "Запущен опрос источников 1С. Данные обновятся через несколько секунд."
              : "Локальные данные обновлены.";
        setSyncNotice(message);
        void dashboard.refetch();
        void summary.refetch();
        if (caseId) void detail.refetch();
      }
    });
  };

  const handleExcelDownload = () => {
    if (showAllPositions) {
      if (!aggregatedRows.length) {
        window.alert("Нет позиций для выгрузки в Excel.");
        return;
      }
      try {
        exportTableToExcel(
          "all_positions_estimate",
          [
            { key: "nomenclature_name", title: "Номенклатура" },
            { key: "nomenclature_id", title: "Код" },
            { key: "quantity", title: "Количество" },
            { key: "unit", title: "Ед." },
            { key: "requiredDate", title: "Срок" },
            { key: "priceMin", title: "Цена min" },
            { key: "priceMax", title: "Цена max" },
            { key: "avgUnitPrice", title: "Ср. цена" },
            { key: "amount", title: "Сумма" },
            { key: "overpay", title: "Переплата" },
            { key: "currency", title: "Валюта" },
            { key: "coverageSource", title: "Покрытие" },
            { key: "suppliers", title: "Поставщики" }
          ],
          aggregatedRows.map((row) => ({
            nomenclature_name: row.nomenclature_name,
            nomenclature_id: row.nomenclature_id,
            quantity: row.quantity,
            unit: row.unit,
            requiredDate: row.requiredDate || "",
            priceMin: row.priceMin ?? "",
            priceMax: row.priceMax ?? "",
            avgUnitPrice: row.avgUnitPrice ?? "",
            amount: row.amount ?? "",
            overpay: row.overpay ?? "",
            currency: row.currency,
            coverageSource: row.coverageSource,
            suppliers: row.usedSuppliers
              .map(
                (part) =>
                  `${part.supplier_name || part.supplier_id}${
                    part.quantity != null
                      ? ` (${formatQuantity(String(part.quantity))})`
                      : ""
                  }`
              )
              .join("; ")
          }))
        );
      } catch (exportError) {
        const message =
          exportError instanceof Error
            ? exportError.message
            : "Не удалось выгрузить Excel";
        window.alert(message);
      }
      return;
    }
    if (!caseId) {
      window.alert("Выберите заказ слева, чтобы скачать смету.");
      return;
    }
    if (!positions.length) {
      window.alert("Нет активных позиций для выгрузки сметы.");
      return;
    }
    downloadEstimate.mutate(caseId, {
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : "Не удалось скачать Excel-смету";
        window.alert(message);
      }
    });
  };

  if (permissions.isPending) {
    return (
      <div className={styles.empty}>
        <Loader2 className={styles.spin} size={17} /> Загрузка прав...
      </div>
    );
  }
  if (permissions.isError) {
    const detail =
      (permissions.error as { response?: { data?: { detail?: string } }; message?: string })?.response
        ?.data?.detail ||
      (permissions.error as { message?: string })?.message ||
      "сервер не ответил вовремя";
    return (
      <div className={`${styles.error} ${styles.errorStack}`}>
        <div className={styles.errorRow}>
          <AlertTriangle size={17} /> Не удалось проверить права: {String(detail)}
        </div>
        <button type="button" className={styles.secondary} onClick={() => void permissions.refetch()}>
          <RefreshCw size={14} /> Повторить
        </button>
      </div>
    );
  }
  if (!canAccess) {
    return (
      <div className={`${styles.error} ${styles.errorStack}`}>
        <div className={styles.errorRow}>
          <AlertTriangle size={17} /> Рабочее место менеджера по закупкам недоступно.
        </div>
        <button type="button" className={styles.secondary} onClick={() => void permissions.refetch()}>
          <RefreshCw size={14} /> Проверить снова
        </button>
      </div>
    );
  }

  const currency = workspace?.currency || "RUB";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Менеджер по закупкам</h2>
          <p>Заказы, номенклатура, поставщики, ЗКП и согласования</p>
        </div>
        <div className={styles.hitl}>
          <ShieldCheck size={16} /> Отправка и оплата не выполняются автоматически
        </div>
      </div>

      <section className={styles.kpiRow}>
        <article className={styles.kpiCard}>
          <strong>
            {summary.isLoading ? "…" : summary.data?.uncovered_orders_count ?? 0}
          </strong>
          <span>Необеспеченные поставщиками заказы</span>
        </article>
        <article className={styles.kpiCard}>
          <strong>
            {summary.isLoading ? "…" : summary.data?.active_suppliers_count ?? 0}
          </strong>
          <span>Действующие поставщики</span>
        </article>
        <article className={styles.kpiCard}>
          <strong>
            {summary.isLoading
              ? "…"
              : summary.data?.uncovered_positions_count ??
                summary.data?.nomenclature_count ??
                0}
          </strong>
          <span>Непокрытые позиции</span>
        </article>
      </section>

      {dashboard.isError ? (
        <div className={styles.error}>
          <AlertTriangle size={17} /> Не удалось загрузить очередь заказов.
        </div>
      ) : null}
      {error ? (
        <div className={styles.error}>
          <AlertTriangle size={17} /> {error}
        </div>
      ) : null}
      {syncNotice ? <div className={styles.notice}>{syncNotice}</div> : null}

      <div className={styles.workspace}>
        <section className={styles.queue}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Заказы</h3>
              <p className={styles.muted}>В очереди: {cases.length}</p>
            </div>
            <button
              className={styles.secondary}
              onClick={() => {
                void dashboard.refetch();
                void summary.refetch();
              }}
              type="button"
            >
              <RefreshCw size={15} />
            </button>
          </div>
          {dashboard.isLoading ? (
            <div className={styles.empty}>
              <Loader2 className={styles.spin} size={16} /> Загрузка...
            </div>
          ) : null}
          {!dashboard.isLoading && !cases.length ? (
            <div className={styles.empty}>Очередь пуста.</div>
          ) : null}
          <div className={styles.caseList}>
            {cases.map((item) => {
              const coverage = deriveOrderCoverage(item);
              const requiredDate = orderRequiredDate(item);
              const baseClass =
                !showAllPositions && item.id === caseId ? styles.caseActive : styles.case;
              return (
                <button
                  className={`${baseClass} ${COVERAGE_CASE_CLASS[coverage.tone]}`}
                  key={item.id}
                  onClick={() => {
                    // Per-order mode: leave «Все позиции» so table/total scope to this case.
                    setShowAllPositions(false);
                    setParams({ case: item.id });
                  }}
                  type="button"
                  title={`${coverage.label}: ${coverage.covered_count}/${coverage.positions_count} поз. покрыто`}
                >
                  <div className={styles.row}>
                    <strong>{caseTitle(item)}</strong>
                    <span className={`${styles.badge} ${COVERAGE_BADGE_CLASS[coverage.tone]}`}>
                      {coverage.label}
                    </span>
                  </div>
                  <small>
                    {item.positions_count} поз.
                  </small>
                  <small className={styles.requiredDate}>
                    Срок поставки: {formatDate(requiredDate)}
                  </small>
                  {item.summary ? <small>{item.summary}</small> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.positionsPanel}`}>
          {!caseId ? (
            <div className={styles.empty}>Выберите заказ слева.</div>
          ) : detail.isLoading ? (
            <div className={styles.empty}>
              <Loader2 className={styles.spin} size={16} /> Загрузка позиций...
            </div>
          ) : detail.isError || !workspace ? (
            <div className={styles.error}>
              <AlertTriangle size={17} /> Не удалось загрузить заказ.
            </div>
          ) : (
            <>
              <div className={`${styles.sectionHeader} ${styles.positionsHeader}`}>
                <h3
                  title={
                    showAllPositions
                      ? `Все позиции очереди · ${cases.length} заказов`
                      : [
                          workspace.need_title || caseTitle(workspace),
                          workspace.department_name || "—",
                          workspace.source_number || workspace.source_1c_ref,
                          deriveOrderCoverage(workspace).label
                        ].join(" · ")
                  }
                >
                  {showAllPositions
                    ? `Все позиции · ${aggregatedRows.length}`
                    : workspace.need_title || caseTitle(workspace)}
                </h3>
                <div className={styles.actions}>
                  <button
                    aria-pressed={showAllPositions}
                    className={showAllPositions ? styles.toggleActive : styles.secondary}
                    onClick={() => setShowAllPositions((value) => !value)}
                    type="button"
                    title="Сводная таблица по всем заказам очереди"
                  >
                    <Layers size={13} />
                    Все позиции
                  </button>
                  <button
                    className={styles.secondary}
                    disabled={syncFrom1C.isPending}
                    onClick={handleSync}
                    type="button"
                    title="Загрузить позиции из 1С"
                  >
                    {syncFrom1C.isPending ? (
                      <Loader2 className={styles.spin} size={13} />
                    ) : (
                      <Database size={13} />
                    )}
                    Из 1С
                  </button>
                  <button
                    className={styles.secondary}
                    disabled={
                      showAllPositions ||
                      updateAmounts.isPending ||
                      !caseId
                    }
                    onClick={() => void saveAmounts()}
                    type="button"
                    title={
                      showAllPositions
                        ? "В режиме «Все позиции» цена read-only (min–max). Ввод цены — в карточке заказа."
                        : "Сохранить цены и суммы позиций"
                    }
                  >
                    {updateAmounts.isPending ? (
                      <Loader2 className={styles.spin} size={13} />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                    Сохранить суммы
                  </button>
                  <button
                    className={styles.primary}
                    disabled={
                      downloadEstimate.isPending ||
                      (showAllPositions
                        ? !aggregatedRows.length
                        : !caseId || !positions.length)
                    }
                    onClick={handleExcelDownload}
                    type="button"
                    title={
                      showAllPositions
                        ? "Скачать видимую сводную таблицу (CSV для Excel)"
                        : "Скачать Excel для сметы выбранного заказа"
                    }
                  >
                    {downloadEstimate.isPending ? (
                      <Loader2 className={styles.spin} size={13} />
                    ) : (
                      <FileSpreadsheet size={13} />
                    )}
                    Excel
                  </button>
                </div>
              </div>

              <div className={styles.tableShell}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Номенклатура</th>
                        <th>Кол-во</th>
                        <th title="Требуемая дата поставки">Срок</th>
                        <th
                          title={
                            showAllPositions
                              ? "Диапазон min–max у поставщиков; средняя = сумма / кол-во потребности"
                              : undefined
                          }
                        >
                          Цена
                        </th>
                        <th title={showAllPositions ? amountFormulaHint : undefined}>
                          Сумма
                        </th>
                        <th>Источник покрытия</th>
                        <th title="Только поставщики, фактически использованные аллокацией для покрытия остатка (склад → пусто)">
                          Поставщики
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {showAllPositions ? (
                        allPositions.isLoading || allPositions.isPending ? (
                          <tr>
                            <td colSpan={7}>
                              <Loader2 className={styles.spin} size={14} /> Загрузка позиций
                              очереди...
                            </td>
                          </tr>
                        ) : !aggregatedRows.length ? (
                          <tr>
                            <td colSpan={7}>Нет активных позиций в очереди.</td>
                          </tr>
                        ) : (
                          aggregatedRows.map((row) => (
                            <tr key={row.key}>
                              <td>
                                {row.nomenclature_name}
                                {row.nomenclature_id ? (
                                  <>
                                    <br />
                                    <small className={styles.muted}>
                                      {row.nomenclature_id}
                                    </small>
                                  </>
                                ) : null}
                              </td>
                              <td>
                                {formatQuantity(String(row.quantity))} {row.unit}
                              </td>
                              <td>{formatDate(row.requiredDate)}</td>
                              <td>
                                <span
                                  aria-label={`Цена ${row.nomenclature_name}`}
                                  className={styles.priceRange}
                                  title="Мин–макс unit_price среди поставщиков банка"
                                >
                                  {formatPriceRange(row.priceMin, row.priceMax)}
                                </span>
                                {row.avgUnitPrice != null ? (
                                  <>
                                    <br />
                                    <small
                                      className={styles.muted}
                                      title="Средняя цена = сумма_по_номенклатуре / количество_потребности"
                                    >
                                      ср.{" "}
                                      {row.avgUnitPrice.toLocaleString("ru-RU", {
                                        maximumFractionDigits: 2
                                      })}
                                    </small>
                                  </>
                                ) : null}
                              </td>
                              <td title={row.amountFormula || amountFormulaHint}>
                                {formatMoney(row.amount, row.currency)}
                                {row.overpay != null && row.overpay > 0 ? (
                                  <>
                                    <br />
                                    <small
                                      className={styles.muted}
                                      title="Переплата за избыток лота / мин. заказа сверх потребности"
                                    >
                                      переплата {formatMoney(row.overpay, row.currency)}
                                    </small>
                                  </>
                                ) : null}
                                {row.hasManualOverride ? (
                                  <>
                                    <br />
                                    <small className={styles.muted}>с учётом override</small>
                                  </>
                                ) : null}
                              </td>
                              <td>
                                <CoverageSourceCell cov={row.coverageSourceMeta} />
                              </td>
                              <td>
                                <UsedSuppliersBlock parts={row.usedSuppliers} />
                              </td>
                            </tr>
                          ))
                        )
                      ) : !lineRows.length ? (
                        <tr>
                          <td colSpan={7}>Нет активных позиций.</td>
                        </tr>
                      ) : (
                        lineRows.map((row) => {
                          const cov = coverageByLineId.get(
                            `${workspace?.id}:${row.position.line_id}`
                          );
                          const usedParts = (() => {
                            const fromCoverage = usedSuppliersFromCoverage(cov);
                            if (fromCoverage.length) return fromCoverage;
                            if (cov?.coverage_source === "warehouse") return [];
                            return (
                              poSuppliers.get(row.position.line_id) ??
                              quoteSuppliers.get(row.position.line_id) ??
                              []
                            );
                          })();
                          const lineRequired = positionRequiredDate(
                            row.position,
                            cov?.required_date || workspace?.required_date
                          );
                          return (
                            <tr key={row.position.id}>
                              <td>
                                {row.position.nomenclature_name || row.position.nomenclature_id}
                                <br />
                                <small className={styles.muted}>
                                  {row.position.nomenclature_id}
                                </small>
                              </td>
                              <td>
                                {formatQuantity(row.position.quantity)}{" "}
                                {row.position.unit || "шт"}
                              </td>
                              <td>{formatDate(lineRequired)}</td>
                              <td>
                                <input
                                  aria-label={`Цена ${row.position.nomenclature_name || row.position.line_id}`}
                                  className={styles.amountInput}
                                  min={0}
                                  onChange={(event) =>
                                    setDraftPrices((current) => ({
                                      ...current,
                                      [row.position.line_id]: event.target.value
                                    }))
                                  }
                                  placeholder="—"
                                  step="0.01"
                                  type="number"
                                  value={draftPrices[row.position.line_id] ?? ""}
                                />
                              </td>
                              <td>{formatMoney(row.amount, row.currency)}</td>
                              <td>
                                <CoverageSourceCell
                                  cov={cov}
                                  fallback={row.source}
                                />
                              </td>
                              <td>
                                <UsedSuppliersBlock parts={usedParts} />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={styles.totalBar}>
                  <span>{showAllPositions ? "Итого по очереди" : "Итого по заказу"}</span>
                  <strong>
                    {formatMoney(
                      showAllPositions ? aggregatedTotal : totalAmount,
                      currency
                    )}
                  </strong>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <section className={styles.workbench}>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Рабочие действия менеджера</h3>
            <p className={styles.muted}>
              Поиск поставщиков, ЗКП, сравнение КП, HITL и поставка
            </p>
          </div>
        </div>
        {!caseId || !workspace ? (
          <div className={styles.empty}>Выберите заказ, чтобы работать с действиями.</div>
        ) : (
          <>
            <div className={styles.card}>
              <div className={styles.row}>
                <strong>Агент поиска / оценки / заказа</strong>
                <span className={styles.badge}>
                  {agentStatus?.stage || workspace.agent_stage || "не запущен"}
                </span>
              </div>
              <p className={styles.muted}>
                Статус: {agentStatus?.status || workspace.lifecycle_state || "—"} · кандидаты:{" "}
                {agentStatus?.candidates_count ?? suppliers.length} · HITL:{" "}
                {agentStatus?.paused_for_human || workspace.paused_for_human
                  ? agentStatus?.interrupt_type || "ожидает"
                  : "нет"}
              </p>
              {topSuppliersPreview.length ? (
                <p className={styles.muted}>
                  Top-3:{" "}
                  {topSuppliersPreview
                    .map(
                      (offer) =>
                        `${offer.supplier_name || offer.supplier_id} (${offer.score})`
                    )
                    .join(" · ")}
                </p>
              ) : null}
              {(agentStatus?.comparison || comparison) && (
                <p className={styles.muted}>
                  Сравнение КП:{" "}
                  {(agentStatus?.comparison || comparison)?.recommended_quote_id ||
                    "готово"}
                </p>
              )}
              {(agentStatus?.rfq_draft || workspace.rfq_drafts?.[0]) && (
                <p className={styles.muted}>
                  ЗКП:{" "}
                  {agentStatus?.rfq_draft?.subject ||
                    workspace.rfq_drafts?.[0]?.subject ||
                    "черновик"}
                </p>
              )}
              {(agentStatus?.purchase_order_draft || poDrafts[0]) && (
                <p className={styles.muted}>
                  Заказ:{" "}
                  {agentStatus?.purchase_order_draft?.subject ||
                    poDrafts[0]?.subject ||
                    "черновик"}
                </p>
              )}
              <div className={styles.actions}>
                <button
                  className={styles.primary}
                  disabled={runAgent.isPending || !caseId}
                  onClick={() => {
                    if (!caseId) return;
                    runAgent.mutate(
                      {
                        caseId,
                        payload: {
                          idempotency_key: key("agent-run"),
                          allow_web_fallback: true
                        }
                      },
                      {
                        onSuccess: (status) => {
                          if (status.paused_for_human) setHitlOpen(true);
                        }
                      }
                    );
                  }}
                  type="button"
                >
                  {runAgent.isPending ? (
                    <Loader2 className={styles.spin} size={15} />
                  ) : (
                    <Layers size={15} />
                  )}{" "}
                  Запустить агента
                </button>
                {(agentStatus?.paused_for_human || workspace.paused_for_human) && (
                  <button
                    className={styles.secondary}
                    onClick={() => setHitlOpen(true)}
                    type="button"
                  >
                    <ShieldCheck size={15} /> Открыть HITL
                  </button>
                )}
                <button
                  className={styles.secondary}
                  disabled={runStrategy.isPending}
                  onClick={() => {
                    runStrategy.mutate(
                      {
                        idempotency_key: key("strategy-run"),
                        allow_web_fallback: true,
                        case_ids: cases.map((item) => item.id)
                      },
                      {
                        onSuccess: (status) => {
                          setTab("policy");
                          if (status.paused_for_human) setStrategyHitlOpen(true);
                        }
                      }
                    );
                  }}
                  type="button"
                >
                  {runStrategy.isPending ? (
                    <Loader2 className={styles.spin} size={15} />
                  ) : (
                    <Layers size={15} />
                  )}{" "}
                  Политика очереди
                </button>
                {(strategyStatus?.paused_for_human || strategyHitlOpen) &&
                strategyStatus?.paused_for_human ? (
                  <button
                    className={styles.secondary}
                    onClick={() => setStrategyHitlOpen(true)}
                    type="button"
                  >
                    <ShieldCheck size={15} /> HITL политики
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.tabs}>
              {TABS.map((item) => (
                <button
                  className={tab === item.id ? styles.tabActive : styles.tab}
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "policy" ? (
              <>
                <div className={styles.sectionHeader}>
                  <h4>Политика поставок (очередь)</h4>
                  <span className={styles.badge}>
                    {strategyStatus?.stage || "не запущена"} ·{" "}
                    {strategyStatus?.status || "—"}
                  </span>
                </div>
                <p className={styles.muted}>
                  Срочные заказы закрываются первыми (склад/банк), затем менее срочные — с
                  возможностью других, более дешёвых поставщиков на остатке.
                </p>
                {!strategyStatus?.waves?.waves?.length ? (
                  <div className={styles.empty}>
                    Запустите «Политика очереди», чтобы построить волны срочности и назначения.
                  </div>
                ) : (
                  <>
                    <div className={styles.notice}>
                      {strategyStatus.explanation?.summary ||
                        strategyStatus.explanation?.text ||
                        "Волны построены."}
                    </div>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Волна</th>
                            <th>Режим</th>
                            <th>Заказы</th>
                            <th>Комментарий</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(strategyStatus.waves?.waves ?? []).map((wave) => (
                            <tr key={wave.wave_id || wave.label}>
                              <td>
                                {WAVE_LABEL_RU[wave.label || ""] ||
                                  wave.label ||
                                  wave.wave_id ||
                                  "—"}
                              </td>
                              <td>
                                {WAVE_LABEL_RU[wave.mode || ""] || wave.mode || "—"}
                              </td>
                              <td>{(wave.case_ids || []).length}</td>
                              <td className={styles.muted}>{wave.reason || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(strategyStatus.supplier_diversity?.length ?? 0) > 0 ? (
                      <>
                        <h4>Альтернативы для поздних заказов</h4>
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>Номенклатура</th>
                                <th>Срочный поставщик</th>
                                <th>Экономичный</th>
                                <th>Причина</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(strategyStatus.supplier_diversity ?? []).map((row, index) => (
                                <tr
                                  key={`${row.case_id}-${row.line_id}-${index}`}
                                >
                                  <td>
                                    {row.nomenclature_name || row.nomenclature_id || "—"}
                                  </td>
                                  <td>{row.urgent_supplier_id || "—"}</td>
                                  <td>{row.economy_supplier_id || "—"}</td>
                                  <td className={styles.muted}>{row.reason || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : null}
                    {(strategyStatus.cost_estimate?.lines?.length ?? 0) > 0 ? (
                      <div className={styles.notice}>
                        Смета стратегии: итого{" "}
                        {strategyStatus.cost_estimate?.total_estimated_amount != null
                          ? `${Number(
                              strategyStatus.cost_estimate.total_estimated_amount
                            ).toLocaleString("ru-RU")} ₽`
                          : "—"}
                        {" · "}
                        PO-черновиков:{" "}
                        {(strategyStatus.purchase_order_drafts ?? []).length}
                      </div>
                    ) : null}
                    {(strategyStatus.explanation?.tradeoffs as string[] | undefined)
                      ?.length ? (
                      <ul className={styles.muted}>
                        {(strategyStatus.explanation?.tradeoffs as string[]).map(
                          (item) => (
                            <li key={item}>{item}</li>
                          )
                        )}
                      </ul>
                    ) : null}
                  </>
                )}
              </>
            ) : null}

            {tab === "suppliers" ? (
              <>
                <div className={styles.actions}>
                  <button
                    className={styles.primary}
                    disabled={searchSuppliers.isPending}
                    onClick={() =>
                      searchSuppliers.mutate(
                        {
                          caseId,
                          payload: {
                            idempotency_key: key("supplier-search-manual"),
                            allow_web_fallback: true,
                            force_web: true,
                            mode: "manual_web"
                          }
                        },
                        {
                          onSuccess: (result: SupplierSearchResult) =>
                            setSearchInfo({
                              query: result.query,
                              sources: result.sources_used,
                              web: result.web_fallback_used,
                              nomenclatureResults: result.nomenclature_results ?? []
                            })
                        }
                      )
                    }
                    type="button"
                  >
                    {searchSuppliers.isPending ? (
                      <Loader2 className={styles.spin} size={15} />
                    ) : (
                      <Search size={15} />
                    )}{" "}
                    Найти поставщиков
                  </button>
                </div>
                {searchInfo ? (
                  <div className={styles.notice}>
                    Запрос: {searchInfo.query} · источники:{" "}
                    {searchInfo.sources.join(", ") || "нет"} · web fallback:{" "}
                    {searchInfo.web ? "да" : "нет"}
                    {nomenclatureResults.length
                      ? ` · позиций: ${nomenclatureResults.length}`
                      : ""}
                  </div>
                ) : null}
                {suppliersQuery.isLoading ? (
                  <div className={styles.empty}>
                    <Loader2 className={styles.spin} size={16} /> Загрузка...
                  </div>
                ) : null}
                {!suppliersQuery.isLoading &&
                !nomenclatureResults.length &&
                !suppliers.length ? (
                  <div className={styles.empty}>Кандидаты не найдены.</div>
                ) : null}
                {nomenclatureResults.length ? (
                  <div className={styles.nomenclatureStack}>
                    {nomenclatureResults.map((nom) => {
                      const nomKey =
                        nom.nomenclature_id || nom.nomenclature_name || nom.query;
                      return (
                        <section className={styles.nomenclatureCard} key={nomKey}>
                          <div className={styles.nomenclatureHeader}>
                            <div>
                              <h4>
                                {nom.nomenclature_name ||
                                  nom.nomenclature_id ||
                                  nom.query}
                              </h4>
                              {nom.nomenclature_id &&
                              nom.nomenclature_name &&
                              nom.nomenclature_id !== nom.nomenclature_name ? (
                                <p className={styles.muted}>{nom.nomenclature_id}</p>
                              ) : null}
                            </div>
                            <span className={styles.badge}>
                              {(nom.sources_used || [])
                                .map(sourceBadgeLabel)
                                .join(", ") || "нет источников"}
                              {nom.web_fallback_used &&
                              !(nom.sources_used || []).includes("web")
                                ? " · web"
                                : ""}
                            </span>
                          </div>
                          {(() => {
                            // Manual «Найти поставщиков»: show only live web cards.
                            const webSuppliers = (nom.suppliers || []).filter(
                              (item) => item.source === "web"
                            );
                            if (!webSuppliers.length) {
                              return (
                                <div className={styles.empty}>
                                  Веб-поставщики по этой позиции не найдены.
                                </div>
                              );
                            }
                            return (
                            <div className={styles.supplierGrid}>
                              {webSuppliers.map((supplier) => {
                                const link =
                                  supplier.url ||
                                  supplier.contacts?.website ||
                                  null;
                                const cost =
                                  supplier.approx_cost ?? supplier.unit_price ?? null;
                                const rating =
                                  supplier.rating ??
                                  averageRating(supplier) ??
                                  null;
                                return (
                                  <div
                                    className={`${styles.card} ${
                                      selectedSupplierIds.includes(supplier.supplier_id)
                                        ? styles.cardSelected
                                        : ""
                                    }`}
                                    key={`${nomKey}:${supplier.supplier_id}`}
                                  >
                                    <div className={styles.row}>
                                      <strong>{supplier.name}</strong>
                                      <span className={styles.badge}>
                                        {sourceBadgeLabel(supplier.source)}
                                      </span>
                                    </div>
                                    {link ? (
                                      <p>
                                        <a
                                          className={styles.supplierLink}
                                          href={link}
                                          rel="noopener noreferrer"
                                          target="_blank"
                                        >
                                          ссылка
                                        </a>
                                      </p>
                                    ) : (
                                      <p className={styles.muted}>Ссылка не указана</p>
                                    )}
                                    <p>
                                      Город: {supplier.city || "—"} · оценка:{" "}
                                      {rating != null ? String(rating) : "—"} · примерная
                                      стоимость:{" "}
                                      {cost != null
                                        ? `${Number(cost).toLocaleString("ru-RU")} ₽`
                                        : "—"}
                                    </p>
                                    <p className={styles.muted}>
                                      Качество {supplier.quality_rating} · доставка{" "}
                                      {supplier.delivery_rating} · коммерческий{" "}
                                      {supplier.commercial_rating}
                                    </p>
                                    <div className={styles.actions}>
                                      <label>
                                        <input
                                          checked={selectedSupplierIds.includes(
                                            supplier.supplier_id
                                          )}
                                          onChange={() =>
                                            toggleSupplier(supplier.supplier_id)
                                          }
                                          type="checkbox"
                                        />{" "}
                                        В ЗКП
                                      </label>
                                      <button
                                        className={styles.secondary}
                                        onClick={() =>
                                          setConfirmAction({ type: "supplier", supplier })
                                        }
                                        type="button"
                                      >
                                        Согласовать выбор
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            );
                          })()}
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.supplierGrid}>
                    {suppliers.map((supplier) => (
                      <div
                        className={`${styles.card} ${
                          selectedSupplierIds.includes(supplier.supplier_id)
                            ? styles.cardSelected
                            : ""
                        }`}
                        key={supplier.supplier_id}
                      >
                        <div className={styles.row}>
                          <strong>{supplier.name}</strong>
                          <span className={styles.badge}>
                            {sourceBadgeLabel(supplier.source)}
                          </span>
                        </div>
                        <p>ИНН: {supplier.tax_id || "—"}</p>
                        <p>
                          Качество {supplier.quality_rating} · доставка{" "}
                          {supplier.delivery_rating} · коммерческий{" "}
                          {supplier.commercial_rating}
                        </p>
                        <div className={styles.actions}>
                          <label>
                            <input
                              checked={selectedSupplierIds.includes(supplier.supplier_id)}
                              onChange={() => toggleSupplier(supplier.supplier_id)}
                              type="checkbox"
                            />{" "}
                            В ЗКП
                          </label>
                          <button
                            className={styles.secondary}
                            onClick={() => setConfirmAction({ type: "supplier", supplier })}
                            type="button"
                          >
                            Согласовать выбор
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {tab === "estimate" ? (
              <>
                <div className={styles.sectionHeader}>
                  <h4>Смета агента</h4>
                  <span className={styles.badge}>
                    1C / internal + web только после HITL
                  </span>
                </div>
                {(() => {
                  const estimate =
                    agentStatus?.cost_estimate ||
                    agentStatus?.evaluation?.cost_estimate ||
                    null;
                  const lines = estimate?.lines ?? [];
                  if (!estimate || !lines.length) {
                    return (
                      <div className={styles.empty}>
                        Смета появится после «Запустить агента» и подтверждения shortlist
                        (HITL). Неодобренный web в смету не входит.
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className={styles.notice}>
                        Итого:{" "}
                        {estimate.total_estimated_amount != null
                          ? `${Number(estimate.total_estimated_amount).toLocaleString("ru-RU")} ₽`
                          : "—"}
                        {" · "}
                        web в смете:{" "}
                        {estimate.web_approved || estimate.kpi_flags?.web_included
                          ? "да (одобрен HITL)"
                          : "нет"}
                        {estimate.excluded_unapproved_web
                          ? " · неодобренный web исключён"
                          : ""}
                      </div>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Номенклатура</th>
                              <th>Кол-во</th>
                              <th>Сумма</th>
                              <th>Поставщики</th>
                              <th>Источники</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((line) => (
                              <tr key={line.line_id || line.nomenclature_id}>
                                <td>
                                  {line.nomenclature_name ||
                                    line.nomenclature_id ||
                                    "—"}
                                </td>
                                <td>{line.need_qty ?? "—"}</td>
                                <td>
                                  {line.estimated_amount != null
                                    ? `${Number(line.estimated_amount).toLocaleString("ru-RU")} ₽`
                                    : "—"}
                                </td>
                                <td>
                                  {(line.top_suppliers || [])
                                    .slice(0, 3)
                                    .map(
                                      (offer) =>
                                        `${offer.supplier_name || offer.supplier_id}${
                                          offer.source ? ` [${offer.source}]` : ""
                                        }`
                                    )
                                    .join(", ") || "—"}
                                </td>
                                <td>
                                  {(line.estimate_sources || [])
                                    .map(sourceBadgeLabel)
                                    .join(", ") || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : null}

            {tab === "quotes" ? (
              <>
                <div className={styles.sectionHeader}>
                  <h4>Сравнение предложений</h4>
                  <span className={styles.badge}>
                    Веса: цена {comparison?.weights.price ?? "—"} · срок{" "}
                    {comparison?.weights.delivery ?? "—"} · качество{" "}
                    {comparison?.weights.quality ?? "—"} · риск {comparison?.weights.risk ?? "—"}
                  </span>
                </div>
                {comparisonQuery.isLoading ? (
                  <div className={styles.empty}>
                    <Loader2 className={styles.spin} size={16} /> Расчёт...
                  </div>
                ) : null}
                {!comparison?.scores.length && !comparisonQuery.isLoading ? (
                  <div className={styles.empty}>Нет данных для сравнения.</div>
                ) : null}
                {comparison?.scores.length ? (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Ранг</th>
                          <th>Поставщик / КП</th>
                          <th>Итого</th>
                          <th>Цена</th>
                          <th>Срок</th>
                          <th>Качество</th>
                          <th>Риск</th>
                          <th>Финал</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.scores.map((score) => {
                          const quote = quoteById.get(score.quote_id);
                          return (
                            <tr key={score.quote_id}>
                              <td>#{score.rank}</td>
                              <td>
                                {supplierById.get(score.supplier_id)?.name || score.supplier_id}
                                <br />
                                <small>
                                  {score.quote_id}
                                  {comparison.recommended_quote_id === score.quote_id
                                    ? " · рекомендовано"
                                    : ""}
                                </small>
                              </td>
                              <td>
                                {score.total.toLocaleString("ru-RU")}{" "}
                                {quote?.currency || currency}
                              </td>
                              <td>{score.price_score}</td>
                              <td>{score.delivery_score}</td>
                              <td>{score.quality_score}</td>
                              <td>{score.risk_score}</td>
                              <td>
                                {score.final_score}
                                {!score.eligible ? (
                                  <>
                                    <br />
                                    <small>{score.reasons.join("; ")}</small>
                                  </>
                                ) : null}
                              </td>
                              <td>
                                <button
                                  className={styles.secondary}
                                  disabled={!score.eligible}
                                  onClick={() => setConfirmAction({ type: "price", score })}
                                  type="button"
                                >
                                  Согласовать цену
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {supplierApproval ? (
                  <div className={styles.notice}>
                    Одобрен выбор{" "}
                    {supplierById.get(supplierApproval.supplierId)?.name ||
                      supplierApproval.supplierId}
                    . После одобрения его цены будет создана рекомендация.
                  </div>
                ) : null}
                <form className={styles.formGrid} onSubmit={submitQuote}>
                  <label className={styles.field}>
                    Поставщик
                    <select defaultValue="" name="supplier_id" required>
                      <option disabled value="">
                        Выберите
                      </option>
                      {suppliers.map((item) => (
                        <option key={item.supplier_id} value={item.supplier_id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Позиция
                    <select defaultValue="" name="line_id" required>
                      <option disabled value="">
                        Выберите
                      </option>
                      {positions.map((item) => (
                        <option key={item.line_id} value={item.line_id}>
                          {item.nomenclature_name || item.nomenclature_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Цена за единицу
                    <input min="0" name="unit_price" required step="0.01" type="number" />
                  </label>
                  <label className={styles.field}>
                    Количество
                    <input min="0.0001" name="quantity" required step="any" type="number" />
                  </label>
                  <label className={styles.field}>
                    Срок поставки, дней
                    <input min="0" name="delivery_days" required type="number" />
                  </label>
                  <label className={styles.field}>
                    Валюта
                    <input defaultValue="RUB" maxLength={3} minLength={3} name="currency" required />
                  </label>
                  <label className={styles.field}>
                    ЗКП
                    <select name="rfq_id">
                      <option value="">Без ЗКП</option>
                      {workspace.rfq_drafts?.map((item) => (
                        <option key={item.rfq_id} value={item.rfq_id}>
                          {item.rfq_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Действует до
                    <input name="valid_until" type="date" />
                  </label>
                  <label className={styles.field}>
                    Условия оплаты
                    <input name="payment_terms" />
                  </label>
                  <label className={styles.field}>
                    Гарантия, мес.
                    <input defaultValue="0" min="0" name="warranty_months" type="number" />
                  </label>
                  <label className={styles.field}>
                    Качество, 0–100
                    <input defaultValue="50" max="100" min="0" name="quality_score" type="number" />
                  </label>
                  <label className={styles.field}>
                    Риск, 0–100
                    <input defaultValue="0" max="100" min="0" name="risk_score" type="number" />
                  </label>
                  <label className={styles.field}>
                    <span>Соответствует требованиям</span>
                    <input defaultChecked name="compliant" type="checkbox" />
                  </label>
                  <div className={styles.actions}>
                    <button
                      className={styles.primary}
                      disabled={
                        captureQuote.isPending || !suppliers.length || !positions.length
                      }
                      type="submit"
                    >
                      Внести КП
                    </button>
                  </div>
                </form>
              </>
            ) : null}

            {tab === "rfq" ? (
              <>
                <div className={styles.actions}>
                  <p className={styles.muted}>
                    В черновик попадут {rfqLines.length} активных позиций кейса.
                  </p>
                  <button
                    className={styles.primary}
                    disabled={
                      !selectedSupplierIds.length || !rfqLines.length || createRfq.isPending
                    }
                    onClick={() =>
                      createRfq.mutate({
                        caseId,
                        payload: {
                          supplier_ids: selectedSupplierIds,
                          lines: rfqLines,
                          idempotency_key: key("rfq-draft")
                        }
                      })
                    }
                    type="button"
                  >
                    <FileText size={15} /> Создать черновик
                  </button>
                </div>
                {!rfqLines.length ? (
                  <div className={styles.error}>
                    Нельзя создать ЗКП: в кейсе нет активных позиций с положительным количеством.
                  </div>
                ) : null}
                {!workspace.rfq_drafts?.length ? (
                  <div className={styles.empty}>Черновиков нет.</div>
                ) : (
                  workspace.rfq_drafts.map((draft) => (
                    <div className={styles.card} key={draft.rfq_id}>
                      <div className={styles.row}>
                        <strong>{draft.subject}</strong>
                        <span className={styles.badge}>{draft.status}</span>
                      </div>
                      <p>{draft.body}</p>
                      <p className={styles.muted}>
                        {draft.lines.length} строк · {draft.supplier_ids.length} поставщиков ·{" "}
                        {formatDateTime(draft.created_at)}
                      </p>
                      <div className={styles.actions}>
                        <span className={styles.hitl}>
                          <ShieldCheck size={14} /> Не отправлен
                        </span>
                        <button
                          className={styles.primary}
                          onClick={() =>
                            setConfirmAction({ type: "rfq", rfqId: draft.rfq_id })
                          }
                          type="button"
                        >
                          Согласовать отправку
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : null}

            {tab === "order" ? (
              <>
                <div className={styles.actions}>
                  <p className={styles.muted}>
                    Черновики заказа поставщику. Не отправляются и не оплачиваются агентом.
                  </p>
                </div>
                {!poDrafts.length && !agentStatus?.purchase_order_draft ? (
                  <div className={styles.empty}>Черновиков заказа нет.</div>
                ) : (
                  [
                    ...(agentStatus?.purchase_order_draft &&
                    !poDrafts.some(
                      (item) => item.po_id === agentStatus.purchase_order_draft?.po_id
                    )
                      ? [agentStatus.purchase_order_draft]
                      : []),
                    ...poDrafts
                  ].map((draft) => (
                    <div className={styles.card} key={draft.po_id}>
                      <div className={styles.row}>
                        <strong>{draft.subject}</strong>
                        <span className={styles.badge}>{draft.status}</span>
                      </div>
                      <p>{draft.body}</p>
                      <p className={styles.muted}>
                        {draft.supplier_name} · {draft.lines.length} строк · итого{" "}
                        {draft.total} {draft.currency} ·{" "}
                        {formatDateTime(draft.created_at)}
                      </p>
                      <div className={styles.actions}>
                        <span className={styles.hitl}>
                          <ShieldCheck size={14} /> Оплата запрещена
                        </span>
                        <button
                          className={styles.secondary}
                          onClick={() =>
                            downloadTextFile(
                              `${draft.po_id || "purchase-order"}.txt`,
                              `${draft.subject}\n\n${draft.body}`
                            )
                          }
                          type="button"
                        >
                          <FileText size={15} /> Скачать текст
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : null}

            {tab === "delivery" ? (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Событие</th>
                        <th>Дата</th>
                        <th>Поставщик</th>
                        <th>Трек</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(workspace.shipment_events ?? []).map((item) => (
                        <tr key={item.event_id}>
                          <td>{item.event_type}</td>
                          <td>{formatDateTime(item.occurred_at)}</td>
                          <td>
                            {supplierById.get(item.supplier_id || "")?.name ||
                              item.supplier_id ||
                              "—"}
                          </td>
                          <td>{item.tracking_number || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <form
                  className={styles.formGrid}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    shipment.mutate({
                      caseId,
                      payload: {
                        event: {
                          event_id: key("shipment"),
                          event_type: String(data.get("event_type")) as "ordered",
                          occurred_at: new Date(String(data.get("occurred_at"))).toISOString(),
                          supplier_id: String(data.get("supplier_id") || "") || undefined,
                          tracking_number: String(data.get("tracking_number") || "") || undefined,
                          details: { comment: String(data.get("details") || "") }
                        },
                        approval_id: String(data.get("approval_id")),
                        idempotency_key: key("shipment-submit")
                      }
                    });
                  }}
                >
                  <label className={styles.field}>
                    Событие
                    <select name="event_type">
                      <option value="ordered">Заказано</option>
                      <option value="dispatched">Отгружено</option>
                      <option value="in_transit">В пути</option>
                      <option value="delayed">Задержка</option>
                      <option value="received">Получено</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    Дата и время
                    <input name="occurred_at" required type="datetime-local" />
                  </label>
                  <label className={styles.field}>
                    Поставщик
                    <select name="supplier_id">
                      <option value="">Не указан</option>
                      {suppliers.map((item) => (
                        <option key={item.supplier_id} value={item.supplier_id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Трек-номер
                    <input name="tracking_number" />
                  </label>
                  <label className={styles.field}>
                    Approval ID
                    <input
                      defaultValue={latestRecordShipmentApproval?.approval_id || ""}
                      name="approval_id"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    Детали
                    <input name="details" />
                  </label>
                  <div className={styles.actions}>
                    <button className={styles.primary} disabled={shipment.isPending} type="submit">
                      <Truck size={15} /> Записать событие
                    </button>
                  </div>
                </form>
                <form
                  className={styles.formGrid}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    nonconformity.mutate({
                      caseId,
                      payload: {
                        nonconformity: {
                          nonconformity_id: key("nc"),
                          shipment_event_id:
                            String(data.get("shipment_event_id") || "") || undefined,
                          description: String(data.get("description")),
                          severity: String(data.get("severity")) as "major",
                          quantity_affected: Number(data.get("quantity_affected")) || undefined,
                          evidence: String(data.get("evidence") || "")
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                          created_at: new Date().toISOString()
                        },
                        idempotency_key: key("nc-submit")
                      }
                    });
                  }}
                >
                  <div className={`${styles.sectionHeader} ${styles.full}`}>
                    <h4>Несоответствие и передача в качество</h4>
                  </div>
                  <label className={`${styles.field} ${styles.full}`}>
                    Описание
                    <textarea name="description" required />
                  </label>
                  <label className={styles.field}>
                    Критичность
                    <select name="severity">
                      <option value="minor">Незначительное</option>
                      <option value="major">Существенное</option>
                      <option value="critical">Критическое</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    Количество
                    <input min="0.0001" name="quantity_affected" step="any" type="number" />
                  </label>
                  <label className={styles.field}>
                    Событие поставки
                    <select name="shipment_event_id">
                      <option value="">Не указано</option>
                      {(workspace.shipment_events ?? []).map((item) => (
                        <option key={item.event_id} value={item.event_id}>
                          {item.event_type} · {formatDateTime(item.occurred_at)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Evidence, через запятую
                    <input name="evidence" />
                  </label>
                  <div className={styles.actions}>
                    <button
                      className={styles.danger}
                      disabled={nonconformity.isPending}
                      type="submit"
                    >
                      Зафиксировать и передать
                    </button>
                  </div>
                </form>
              </>
            ) : null}

            {tab === "audit" ? (
              <div className={styles.timeline}>
                {!(workspace.timeline ?? []).length ? (
                  <div className={styles.empty}>Событий нет.</div>
                ) : (
                  (workspace.timeline ?? []).map((entry) => (
                    <div
                      className={styles.timelineItem}
                      key={entry.id || `${entry.at}-${entry.title}`}
                    >
                      <span className={styles.dot} />
                      <div>
                        <div className={styles.row}>
                          <strong>{entry.title}</strong>
                          <span className={styles.muted}>{formatDateTime(entry.at)}</span>
                        </div>
                        <p>{entry.detail || entry.kind}</p>
                        <small className={styles.muted}>
                          {entry.actor_label || entry.actor_id || "Система"}
                        </small>
                      </div>
                    </div>
                  ))
                )}
                {(workspace.approvals ?? []).map((item) => (
                  <div className={styles.timelineItem} key={item.approval_id}>
                    <span className={styles.dot} />
                    <div>
                      <div className={styles.row}>
                        <strong>HITL: {item.operation}</strong>
                        <span className={styles.badge}>{item.status}</span>
                      </div>
                      <p>{item.comment || item.approval_id}</p>
                      <small className={styles.muted}>{formatDateTime(item.created_at)}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>

      <ConfirmDialog
        action={confirmAction}
        isSuperuser={isSuperuser}
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirm}
        pending={approval.isPending || recommendation.isPending}
      />
      {hitlOpen ? (
        <AgentHitlModal
          onClose={() => setHitlOpen(false)}
          onResume={(action) => {
            if (!caseId) return;
            resumeAgent.mutate(
              {
                caseId,
                payload: {
                  action,
                  idempotency_key: key(`agent-resume-${action}`)
                }
              },
              {
                onSuccess: () => setHitlOpen(false)
              }
            );
          }}
          pending={resumeAgent.isPending}
          status={agentStatus}
        />
      ) : null}
      {strategyHitlOpen ? (
        <StrategyHitlModal
          onClose={() => setStrategyHitlOpen(false)}
          onResume={(action) => {
            resumeStrategy.mutate(
              {
                action,
                idempotency_key: key(`strategy-resume-${action}`)
              },
              {
                onSuccess: () => setStrategyHitlOpen(false)
              }
            );
          }}
          pending={resumeStrategy.isPending}
          status={strategyStatus}
        />
      ) : null}
    </div>
  );
}
