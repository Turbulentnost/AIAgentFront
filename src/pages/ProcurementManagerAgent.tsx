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
import { Link, useSearchParams } from "react-router-dom";
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
  useUpdateProcurementLineAmounts,
  useUpdateProcurementLineSchedule
} from "@/hooks/useProcurementManager";
import { exportTableToExcel } from "@/utils/exportTableToExcel";
import type {
  AgentResumeAction,
  AgentStatus,
  ApprovalOperation,
  ApprovalRecord,
  FulfillmentStatus,
  FulfillmentTone,
  LineAmountEntry,
  NomenclatureSupplierResult,
  OrderCoverageStatus,
  OrderCoverageTone,
  ProcurementManagerCaseDetail,
  ProcurementManagerCaseSummary,
  PurchaseBatch,
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
import { createId } from "@/utils/createId";
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
  { id: "audit", label: "Согласования / Аудит" }
];

const WAVE_LABEL_RU: Record<string, string> = {
  critical: "критично",
  medium: "средне",
  late: "поздно",
  urgent: "срочно",
  economy: "экономия"
};

const SOURCE_BADGE_LABEL: Record<string, string> = {
  existing: "банк",
  internal: "внутренний",
  "1c": "1С",
  web: "веб",
  procurement_supplier_mcp: "1С/MCP"
};

/** Display labels for agent/strategy machine status codes (API values stay English). */
const AGENT_STATUS_LABEL_RU: Record<string, string> = {
  comparison_ready: "сравнение готово",
  approval_required: "требуется согласование",
  waiting_human: "ожидает человека",
  agent_running: "агент выполняется",
  running: "выполняется",
  completed: "завершено",
  failed: "ошибка",
  suppliers_identified: "поставщики найдены",
  supplier_search_timeout: "таймаут поиска поставщиков",
  shortlist_approved: "список поставщиков одобрен",
  rejected: "отклонено",
  order_draft_approved: "черновик заказа одобрен",
  order_rejected: "заказ отклонён",
  order_approval_required: "требуется согласование заказа",
  policy_approved: "политика одобрена",
  purchase_order_draft: "черновик заказа",
  rfq_draft: "черновик ЗКП",
  quotes_received: "КП получены",
  quotes_ready: "КП готовы",
  approved: "одобрено",
  nonconformity: "несоответствие",
  human_required: "требуется человек",
  purchase_draft: "черновик закупки",
  ordered: "заказано",
  dispatched: "отгружено",
  in_transit: "в пути",
  delayed: "задержка",
  received: "получено",
  draft: "черновик",
  approved_draft: "одобренный черновик",
  requested: "запрошено",
  executed: "выполнено"
};

const AGENT_STAGE_LABEL_RU: Record<string, string> = {
  load_context: "загрузка контекста",
  allocate_bank: "распределение со склада/банка",
  search_internal: "поиск внутренних поставщиков",
  decide_sufficiency: "проверка достаточности",
  search_web: "веб-поиск",
  normalize_dedupe: "нормализация и дедупликация",
  rank_offers: "ранжирование предложений",
  compose_rfq: "формирование ЗКП",
  await_supplier_hitl: "ожидает согласования списка поставщиков",
  compose_cost_estimate: "расчёт сметы",
  ingest_quotes: "приём КП",
  compare_quotes: "сравнение КП",
  compose_purchase_order: "формирование заказа",
  await_order_hitl: "ожидает согласования заказа",
  persist_artifacts: "сохранение результатов",
  load_queue: "загрузка очереди",
  plan_urgency_waves: "планирование волн срочности",
  allocate_bank_global: "глобальное распределение банка",
  gather_internal: "сбор внутренних поставщиков",
  decide_web: "решение о веб-поиске",
  gather_web: "веб-сбор",
  optimize_wave_loop: "оптимизация волн",
  compose_policy: "формирование политики",
  await_policy_hitl: "ожидает согласования политики",
  compose_estimates_and_pos: "сметы и черновики заказов",
  persist: "сохранение"
};

const INTERRUPT_LABEL_RU: Record<string, string> = {
  procurement_shortlist_approval: "согласование списка поставщиков",
  procurement_order_approval: "согласование заказа",
  procurement_policy_approval: "согласование политики поставок"
};

const APPROVAL_OPERATION_LABEL_RU: Record<string, string> = {
  select_supplier: "выбор поставщика",
  approve_price: "согласование цены",
  send_rfq: "отправка ЗКП",
  create_supplier_order: "создание заказа поставщику",
  update_supplier_order: "обновление заказа поставщику",
  record_shipment: "запись поставки"
};

const SHIPMENT_EVENT_LABEL_RU: Record<string, string> = {
  ordered: "Заказано",
  dispatched: "Отгружено",
  in_transit: "В пути",
  delayed: "Задержка",
  received: "Получено"
};

function labelRu(
  code: string | null | undefined,
  map: Record<string, string>,
  fallback?: string
): string {
  if (code == null || String(code).trim() === "") return fallback ?? "—";
  const key = String(code);
  return map[key] ?? map[key.toLowerCase()] ?? fallback ?? key;
}

function sourceBadgeLabel(source: string): string {
  return labelRu(source, SOURCE_BADGE_LABEL, source);
}

function agentStageLabel(stage: string | null | undefined, fallback = "не запущен"): string {
  return labelRu(stage, AGENT_STAGE_LABEL_RU, fallback);
}

function agentStatusLabel(status: string | null | undefined, fallback = "—"): string {
  return labelRu(status, AGENT_STATUS_LABEL_RU, fallback);
}

function interruptLabel(interrupt: string | null | undefined, fallback = "ожидает"): string {
  if (interrupt == null || String(interrupt).trim() === "") return fallback;
  const mapped = labelRu(interrupt, INTERRUPT_LABEL_RU, "");
  if (mapped) return mapped;
  const value = String(interrupt).toLowerCase();
  if (value.includes("order")) return "согласование заказа";
  if (value.includes("policy")) return "согласование политики поставок";
  if (value.includes("shortlist") || value.includes("rfq")) {
    return "согласование списка поставщиков";
  }
  return fallback;
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
            : "Подтвердить список поставщиков / ЗКП?"}
        </h3>
        <p>
          {isOrder
            ? "Агент подготовил черновик заказа поставщику. Оплата и отправка в 1С запрещены."
            : "Агент собрал кандидатов из 1С, внутренних источников и веба. Подтвердите список — смета строится из доверенных и одобренного веба."}
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
            ? "Очередная стратегия подготовила черновики заказов по поставщикам. Оплата и 1С запрещены."
            : "Подтвердите волны срочности и список поставщиков. Смета и заказы строятся из доверенных и одобренного веба."}
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

const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  no_supplier: "Не выбран поставщик",
  payment: "Оплата (в процессе)",
  delivery: "Поставка",
  otk_presentation: "Предъявление ОТК",
  posting: "Оприходование",
  completed: "Выполнен"
};

const QUEUE_FILTERS: Array<{ id: "all" | FulfillmentStatus; label: string }> = [
  { id: "all", label: "Все в работе" },
  { id: "no_supplier", label: "Не выбран поставщик" },
  { id: "payment", label: "Оплата" },
  { id: "delivery", label: "Поставка" },
  { id: "otk_presentation", label: "Предъявление ОТК" },
  { id: "posting", label: "Оприходование" },
  { id: "completed", label: "Выполнен" }
];

const FULFILLMENT_BADGE_CLASS: Record<string, string> = {
  yellow_blink: styles.badgeStatusYellowBlink,
  blue: styles.badgeStatusBlue,
  yellow: styles.badgeStatusYellow,
  green: styles.badgeStatusGreen,
  muted: styles.badgeStatusMuted
};

const FULFILLMENT_CASE_CLASS: Record<string, string> = {
  yellow_blink: styles.caseStatusYellowBlink,
  blue: styles.caseStatusBlue,
  yellow: styles.caseStatusYellow,
  green: styles.caseStatusGreen,
  muted: styles.caseStatusMuted
};

function deriveFulfillment(
  item: ProcurementManagerCaseSummary | ProcurementManagerCaseDetail
): { status: FulfillmentStatus; label: string; tone: FulfillmentTone | string } {
  const status = (item.fulfillment_status ||
    (item as ProcurementManagerCaseSummary).fulfillment_status ||
    "no_supplier") as FulfillmentStatus;
  const label =
    item.fulfillment_label ||
    FULFILLMENT_LABELS[status] ||
    FULFILLMENT_LABELS.no_supplier;
  const tone = item.fulfillment_tone || (
    status === "no_supplier"
      ? "yellow_blink"
      : status === "payment" || status === "delivery"
        ? "blue"
        : status === "otk_presentation"
          ? "yellow"
          : status === "posting"
            ? "green"
            : "muted"
  );
  return { status, label, tone };
}

/** Idempotency key — must not throw outside secure contexts (LAN http://192.168.x.x). */
const key = (prefix: string) => `${prefix}-${createId()}`;

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
        "Состояние согласования агента потеряно после перезапуска сервера. " +
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
  /** Need qty — used to derive warehouse share when API omits from_*. */
  quantity?: string | number | null;
  used_suppliers?: UsedSupplierPart[] | null;
  supplier_parts?: UsedSupplierPart[] | null;
};

const COVERAGE_SOURCE_LABEL_RU: Record<string, string> = {
  warehouse: "склад",
  supplier: "поставщик",
  mixed: "смешанный",
  none: "нет"
};

/**
 * Resolve warehouse/purchase qtys for mixed coverage.
 * Prefer API from_warehouse/from_supplier for THIS line/row only.
 * Fallback to used supplier parts only when API omits both; clamp purchase
 * to need qty so sibling/nomenclature totals cannot inflate Закупка.
 */
function resolveMixedCoverageQuantities(cov: CoverageSourceDisplay): {
  fromWarehouse: number;
  fromSupplier: number;
} {
  let fromWarehouse = toFiniteNumber(cov.from_warehouse);
  let fromSupplier = toFiniteNumber(cov.from_supplier);
  const parts = cov.used_suppliers?.length
    ? cov.used_suppliers
    : cov.supplier_parts ?? [];
  const usedSum = parts.reduce(
    (sum, part) => sum + (toFiniteNumber(part.quantity) ?? 0),
    0
  );
  const needQty = toFiniteNumber(cov.quantity) ?? 0;
  const apiMissingOrZero =
    (fromWarehouse == null && fromSupplier == null) ||
    ((fromWarehouse ?? 0) <= 0 && (fromSupplier ?? 0) <= 0);
  if (apiMissingOrZero && usedSum > 0) {
    fromSupplier = needQty > 0 ? Math.min(usedSum, needQty) : usedSum;
    fromWarehouse = needQty > 0 ? Math.max(0, needQty - fromSupplier) : 0;
  }
  return {
    fromWarehouse: fromWarehouse ?? 0,
    fromSupplier: fromSupplier ?? 0
  };
}

/** True when the line/row still needs a purchasable (non-warehouse) price. */
function lineNeedsPurchasePrice(
  cov: CoverageSourceDisplay | null | undefined
): boolean {
  if (!cov) return true;
  if (cov.coverage_source === "warehouse") return false;
  const { fromSupplier } = resolveMixedCoverageQuantities(cov);
  if (fromSupplier > 0) return true;
  return (
    cov.coverage_source === "supplier" ||
    cov.coverage_source === "mixed" ||
    cov.coverage_source === "none"
  );
}

function isWarehouseCoverageBatch(batch: Pick<PurchaseBatch, "coverage_source">): boolean {
  return batch.coverage_source === "warehouse";
}

/** Index of the batch that owns the line unit-price input (first non-warehouse). */
function priceOwnerBatchIndex(batches: PurchaseBatch[]): number {
  const idx = batches.findIndex((batch) => !isWarehouseCoverageBatch(batch));
  return idx >= 0 ? idx : 0;
}

/** Mixed: «смешанный · Склад: 25 · Закупка: 75»; other sources keep short label. */
function formatCoverageSourceText(
  cov: CoverageSourceDisplay | null | undefined,
  fallback = "—"
): string {
  if (!cov) return fallback;
  const base =
    COVERAGE_SOURCE_LABEL_RU[cov.coverage_source ?? ""] ||
    cov.coverage_source_label ||
    fallback;
  if (cov.coverage_source !== "mixed") return base || fallback;
  const { fromWarehouse, fromSupplier } = resolveMixedCoverageQuantities(cov);
  return `${base} · Склад: ${formatQuantity(String(fromWarehouse))} · Закупка: ${formatQuantity(String(fromSupplier))}`;
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
    COVERAGE_SOURCE_LABEL_RU[cov.coverage_source ?? ""] ||
    cov.coverage_source_label ||
    fallback;
  if (cov.coverage_source !== "mixed") return <>{base || fallback}</>;
  const { fromWarehouse, fromSupplier } = resolveMixedCoverageQuantities(cov);
  return (
    <>
      {base || "смешанный"}
      <br />
      <small className={styles.muted}>
        Склад: {formatQuantity(String(fromWarehouse))} · Закупка:{" "}
        {formatQuantity(String(fromSupplier))}
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
  const [queueView, setQueueView] = useState<"all" | FulfillmentStatus>("all");
  const [scheduleEdit, setScheduleEdit] = useState<{
    lineId: string;
    leadDays: string;
    shipDate: string;
    batchNo: number;
  } | null>(null);
  const [otkBusy, setOtkBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const permissions = useProcurementManagerPermissions();
  const canAccess = permissions.data?.accessible_role_agents?.includes(AGENT_ID) ?? false;
  const dashboard = useProcurementManagerDashboard(canAccess);
  const summary = useProcurementManagerWorkspaceSummary(canAccess);
  const allPositions = useProcurementManagerAllPositions(canAccess && showAllPositions);
  const allCases = useMemo(() => {
    const list = (dashboard.data?.groups.flatMap((group) => group.cases) ??
      []) as ProcurementManagerCaseSummary[];
    return [...list].sort((a, b) =>
      compareRequiredDateAsc(orderRequiredDate(a), orderRequiredDate(b))
    );
  }, [dashboard.data]);
  const cases = useMemo(() => {
    return allCases.filter((item) => {
      const status = deriveFulfillment(item).status;
      if (queueView === "all") return status !== "completed";
      return status === queueView;
    });
  }, [allCases, queueView]);

  const queueCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const key of Object.keys(FULFILLMENT_LABELS)) counts[key] = 0;
    for (const item of allCases) {
      const status = deriveFulfillment(item).status;
      counts[status] = (counts[status] || 0) + 1;
      if (status !== "completed") counts.all += 1;
    }
    return counts;
  }, [allCases]);
  const caseId = params.get("case") || "";
  const detail = useProcurementManagerCase(caseId || null, canAccess);
  const suppliersQuery = useProcurementManagerSuppliers(caseId || null, canAccess);
  const comparisonQuery = useProcurementManagerComparison(caseId || null, canAccess);
  const agentStatusQuery = useProcurementManagerAgentStatus(caseId || null, canAccess);
  const poDraftsQuery = useProcurementManagerPurchaseOrderDrafts(caseId || null, canAccess);
  const strategyStatusQuery = useProcurementManagerStrategyStatus(canAccess);

  const searchSuppliers = useSearchProcurementSuppliers();
  const updateSchedule = useUpdateProcurementLineSchedule();
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
      const cov = coverageByLine.get(position.line_id);
      // Warehouse-only lines are not purchased — keep price empty, sum stays 0.
      if (
        !lineNeedsPurchasePrice(
          cov
            ? { ...cov, quantity: position.quantity }
            : cov
        )
      ) {
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
      const covDisplay = cov
        ? { ...cov, quantity: position.quantity }
        : null;
      const { fromSupplier } = resolveMixedCoverageQuantities(
        covDisplay ?? { coverage_source: coverageSource, quantity: qty }
      );
      const allowsPrice = lineNeedsPurchasePrice(covDisplay);
      const billablePrice = allowsPrice ? positiveUnitPrice(unitPrice) : null;
      let amount: number | null =
        billablePrice != null && Number.isFinite(qty) ? billablePrice * qty : null;
      // Warehouse stock is not purchased; mixed bills only supplier-covered qty.
      if (!allowsPrice || coverageSource === "warehouse") {
        amount = 0;
      } else if (
        coverageSource === "mixed" &&
        billablePrice != null &&
        Number.isFinite(fromSupplier)
      ) {
        amount = billablePrice * fromSupplier;
      }
      const source =
        !allowsPrice || coverageSource === "warehouse"
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
        unitPrice: allowsPrice ? unitPrice : null,
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
          from_supplier: row.from_supplier,
          quantity: row.quantity,
          used_suppliers: row.used_suppliers,
          supplier_parts: row.supplier_parts
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
    "Сумма = дозакупка у поставщиков: склад → 0; жадное покрытие по цене единицы с учётом лота и мин. заказа. Средняя цена = сумма / кол-во потребности. Переплата = стоимость избытка сверх потребности (отдельно). Цена мин–макс — справочно.";

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
    updateSchedule,
    syncFrom1C,
    downloadEstimate,
    runAgent,
    resumeAgent,
    runStrategy,
    resumeStrategy
  ]);

  const batchesByLine = useMemo(() => {
    const map = new Map<string, PurchaseBatch[]>();
    for (const batch of workspace?.batches ?? []) {
      const list = map.get(batch.line_id) ?? [];
      list.push(batch);
      map.set(batch.line_id, list);
    }
    return map;
  }, [workspace?.batches]);

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
          exportError instanceof Error && exportError.message.trim()
            ? exportError.message
            : "Не удалось выгрузить таблицу в Excel.";
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
          err instanceof Error && err.message.trim()
            ? err.message
            : "Не удалось скачать Excel-смету.";
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
      {actionNotice ? <div className={styles.notice}>{actionNotice}</div> : null}
      {syncNotice ? <div className={styles.notice}>{syncNotice}</div> : null}

      <div className={styles.workspace}>
        <section className={styles.queue}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Заказы</h3>
              <p className={styles.muted}>
                {(QUEUE_FILTERS.find((item) => item.id === queueView)?.label || "Фильтр") +
                  `: ${cases.length}`}
              </p>
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
          <div className={styles.queueTabs} role="tablist" aria-label="Статусы заказов">
            {QUEUE_FILTERS.map((filter) => (
              <button
                aria-selected={queueView === filter.id}
                className={queueView === filter.id ? styles.queueTabActive : styles.queueTab}
                key={filter.id}
                onClick={() => setQueueView(filter.id)}
                role="tab"
                type="button"
              >
                {filter.label}
                <span className={styles.queueTabCount}> ({queueCounts[filter.id] ?? 0})</span>
              </button>
            ))}
          </div>
          {dashboard.isLoading ? (
            <div className={styles.empty}>
              <Loader2 className={styles.spin} size={16} /> Загрузка...
            </div>
          ) : null}
          {!dashboard.isLoading && !cases.length ? (
            <div className={styles.empty}>Нет заказов в этой категории.</div>
          ) : null}
          <div className={styles.caseList}>
            {cases.map((item) => {
              const fulfillment = deriveFulfillment(item);
              const requiredDate = orderRequiredDate(item);
              const baseClass =
                !showAllPositions && item.id === caseId ? styles.caseActive : styles.case;
              const statusClass =
                FULFILLMENT_CASE_CLASS[fulfillment.tone] || styles.caseStatusYellowBlink;
              return (
                <button
                  className={`${baseClass} ${statusClass}`}
                  key={item.id}
                  onClick={() => {
                    setShowAllPositions(false);
                    setParams({ case: item.id });
                  }}
                  type="button"
                  title={fulfillment.label}
                >
                  <div className={styles.row}>
                    <strong>{caseTitle(item)}</strong>
                    <span
                      className={`${styles.badge} ${
                        FULFILLMENT_BADGE_CLASS[fulfillment.tone] || styles.badgeStatusYellowBlink
                      }`}
                    >
                      {fulfillment.label}
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
                  {workspace.show_otk_button ||
                  workspace.fulfillment_status === "otk_presentation" ? (
                    <button
                      className={styles.primary}
                      disabled={otkBusy || !caseId}
                      onClick={() => {
                        if (!caseId) return;
                        setOtkBusy(true);
                        setActionNotice(null);
                        void procurementManagerApi
                          .createOtkPresentation(caseId)
                          .then((result) => {
                            setActionNotice(
                              `Предъявление ОТК создано: ${result.presentation_id}`
                            );
                            void detail.refetch();
                            void dashboard.refetch();
                          })
                          .catch((err) => {
                            setActionNotice(
                              mutationError([{ error: err }]) ||
                                "Не удалось создать предъявление ОТК"
                            );
                          })
                          .finally(() => setOtkBusy(false));
                      }}
                      type="button"
                    >
                      {otkBusy ? (
                        <Loader2 className={styles.spin} size={14} />
                      ) : (
                        <ShieldCheck size={14} />
                      )}{" "}
                      Создать предъявление ОТК
                    </button>
                  ) : null}
                  {workspace.otk_presentation_id ? (
                    <Link
                      className={styles.secondary}
                      to={`/agents/quality-engineer?presentation=${workspace.otk_presentation_id}`}
                    >
                      Открыть ОТК
                    </Link>
                  ) : null}
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
                        <th>Партия</th>
                        <th>Номенклатура</th>
                        <th>Кол-во</th>
                        <th title="Клик — дни или дата поставки от поставщика">Срок</th>
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
                            <td colSpan={8}>
                              <Loader2 className={styles.spin} size={14} /> Загрузка позиций
                              очереди...
                            </td>
                          </tr>
                        ) : !aggregatedRows.length ? (
                          <tr>
                            <td colSpan={8}>Нет активных позиций в очереди.</td>
                          </tr>
                        ) : (
                          aggregatedRows.map((row) => (
                            <tr key={row.key}>
                              <td>—</td>
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
                                  title="Мин–макс цена единицы среди поставщиков банка"
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
                                    <small className={styles.muted}>с учётом ручной правки</small>
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
                          <td colSpan={8}>Нет активных позиций.</td>
                        </tr>
                      ) : (
                        lineRows.flatMap((row) => {
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
                          const lineBatches = batchesByLine.get(row.position.line_id) ?? [];
                          const rowsForLine =
                            lineBatches.length > 0
                              ? lineBatches
                              : [
                                  {
                                    batch_no: 1,
                                    line_id: row.position.line_id,
                                    quantity: Number(row.position.quantity || 0),
                                    required_date: lineRequired,
                                    coverage_source: cov?.coverage_source || "none",
                                    supplier_name: null
                                  } as PurchaseBatch
                                ];
                          const covForDisplay = cov
                            ? {
                                ...cov,
                                quantity: row.position.quantity
                              }
                            : cov;
                          const needsPurchasePrice = lineNeedsPurchasePrice(covForDisplay);
                          const priceBatchIdx = priceOwnerBatchIndex(rowsForLine);
                          return rowsForLine.map((batch, batchIdx) => {
                            const batchRequired = batch.required_date || lineRequired;
                            const editing =
                              scheduleEdit?.lineId === row.position.line_id &&
                              scheduleEdit.batchNo === batch.batch_no;
                            const warehouseBatch = isWarehouseCoverageBatch(batch);
                            // Price input belongs to the first purchase batch, not warehouse.
                            const showPriceInput =
                              needsPurchasePrice &&
                              !warehouseBatch &&
                              batchIdx === priceBatchIdx;
                            const showLineMixedBreakdown =
                              !warehouseBatch && cov?.coverage_source === "mixed";
                            return (
                              <tr key={`${row.position.id}-${batch.batch_no}`}>
                                <td>
                                  №{batch.batch_no}
                                  {batch.is_meter_piece || batch.piece_label ? (
                                    <>
                                      <br />
                                      <small className={styles.muted}>
                                        {batch.piece_label ||
                                          (batch.piece_index
                                            ? `отрезок ${batch.piece_index}`
                                            : "отрезок")}
                                      </small>
                                    </>
                                  ) : null}
                                </td>
                                <td>
                                  {row.position.nomenclature_name || row.position.nomenclature_id}
                                  <br />
                                  <small className={styles.muted}>
                                    {row.position.nomenclature_id}
                                  </small>
                                </td>
                                <td>
                                  {formatQuantity(String(batch.quantity))}{" "}
                                  {batch.unit || row.position.unit || "шт"}
                                </td>
                                <td className={styles.dateCell}>
                                  <button
                                    className={styles.deadlineButton}
                                    onClick={() =>
                                      setScheduleEdit({
                                        lineId: row.position.line_id,
                                        leadDays: String(batch.supplier_lead_days ?? ""),
                                        shipDate: batch.supplier_ship_date?.slice(0, 10) || "",
                                        batchNo: batch.batch_no
                                      })
                                    }
                                    type="button"
                                    title="Ввести дни или дату поставки от поставщика"
                                  >
                                    {formatDate(batch.planned_arrival || batchRequired)}
                                  </button>
                                  {batch.meets_deadline === false ? (
                                    <>
                                      <br />
                                      <small className={styles.muted}>риск срока</small>
                                    </>
                                  ) : null}
                                  {editing ? (
                                    <div className={styles.schedulePopover}>
                                      <label>
                                        Дни поставки
                                        <input
                                          min={0}
                                          onChange={(e) =>
                                            setScheduleEdit((cur) =>
                                              cur
                                                ? { ...cur, leadDays: e.target.value }
                                                : cur
                                            )
                                          }
                                          type="number"
                                          value={scheduleEdit.leadDays}
                                        />
                                      </label>
                                      <label>
                                        Дата отгрузки
                                        <input
                                          onChange={(e) =>
                                            setScheduleEdit((cur) =>
                                              cur
                                                ? { ...cur, shipDate: e.target.value }
                                                : cur
                                            )
                                          }
                                          type="date"
                                          value={scheduleEdit.shipDate}
                                        />
                                      </label>
                                      <div className={styles.actions}>
                                        <button
                                          className={styles.secondary}
                                          onClick={() => setScheduleEdit(null)}
                                          type="button"
                                        >
                                          Отмена
                                        </button>
                                        <button
                                          className={styles.primary}
                                          disabled={updateSchedule.isPending || !caseId}
                                          onClick={() => {
                                            if (!caseId || !scheduleEdit) return;
                                            updateSchedule.mutate(
                                              {
                                                caseId,
                                                lineId: scheduleEdit.lineId,
                                                payload: {
                                                  lead_days: scheduleEdit.leadDays
                                                    ? Number(scheduleEdit.leadDays)
                                                    : null,
                                                  ship_date: scheduleEdit.shipDate || null,
                                                  batch_no: batch.batch_no,
                                                  idempotency_key: key("schedule")
                                                }
                                              },
                                              {
                                                onSuccess: () => setScheduleEdit(null),
                                                onError: (err) =>
                                                  setActionNotice(
                                                    mutationError([{ error: err }]) ||
                                                      "Не удалось сохранить срок"
                                                  )
                                              }
                                            );
                                          }}
                                          type="button"
                                        >
                                          Сохранить
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </td>
                                <td>
                                  {showPriceInput ? (
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
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td>
                                  {showPriceInput
                                    ? formatMoney(row.amount, row.currency)
                                    : warehouseBatch || !needsPurchasePrice
                                      ? formatMoney(0, row.currency)
                                      : batch.unit_price != null
                                        ? formatMoney(
                                            Number(batch.unit_price) * Number(batch.quantity),
                                            row.currency
                                          )
                                        : "—"}
                                </td>
                                <td>
                                  {warehouseBatch ? (
                                    COVERAGE_SOURCE_LABEL_RU.warehouse
                                  ) : showLineMixedBreakdown ? (
                                    <CoverageSourceCell
                                      cov={covForDisplay}
                                      fallback={row.source}
                                    />
                                  ) : batchIdx === 0 ? (
                                    <CoverageSourceCell
                                      cov={covForDisplay}
                                      fallback={row.source}
                                    />
                                  ) : (
                                    labelRu(
                                      batch.coverage_source,
                                      COVERAGE_SOURCE_LABEL_RU,
                                      batch.coverage_source || "—"
                                    )
                                  )}
                                </td>
                                <td>
                                  {warehouseBatch ? (
                                    batch.supplier_name || "Склад"
                                  ) : batch.supplier_name ? (
                                    batch.supplier_name
                                  ) : (
                                    <UsedSuppliersBlock parts={usedParts} />
                                  )}
                                </td>
                              </tr>
                            );
                          });
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
              Поиск поставщиков, ЗКП, сравнение КП, согласования и поставка
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
                  {agentStageLabel(
                    agentStatus?.stage || workspace.agent_stage,
                    "не запущен"
                  )}
                </span>
              </div>
              <p>
                Статус:{" "}
                {agentStatusLabel(
                  agentStatus?.status || workspace.lifecycle_state,
                  "—"
                )}{" "}
                · кандидаты: {agentStatus?.candidates_count ?? suppliers.length} ·
                согласование:{" "}
                {agentStatus?.paused_for_human || workspace.paused_for_human
                  ? interruptLabel(agentStatus?.interrupt_type, "ожидает")
                  : "нет"}
              </p>
              {topSuppliersPreview.length ? (
                <p>
                  Оптимизация топ-3:{" "}
                  {topSuppliersPreview
                    .map((offer) => {
                      const rank =
                        offer.optimization_rank != null
                          ? `#${offer.optimization_rank}`
                          : "—";
                      const deadline =
                        offer.meets_deadline === true
                          ? "в срок"
                          : offer.meets_deadline === false
                            ? "риск срока"
                            : "срок ?";
                      return `${rank} ${offer.supplier_name || offer.supplier_id} (${deadline})`;
                    })
                    .join(" · ")}
                </p>
              ) : null}
              {(agentStatus?.comparison || comparison) && (
                <p>
                  Сравнение КП:{" "}
                  {(agentStatus?.comparison || comparison)?.recommended_quote_id ||
                    "готово"}
                </p>
              )}
              {(agentStatus?.rfq_draft || workspace.rfq_drafts?.[0]) && (
                <p>
                  ЗКП:{" "}
                  {agentStatus?.rfq_draft?.subject ||
                    workspace.rfq_drafts?.[0]?.subject ||
                    "черновик"}
                </p>
              )}
              {(agentStatus?.purchase_order_draft || poDrafts[0]) && (
                <p>
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
                    if (!caseId) {
                      setActionNotice("Выберите заказ слева, затем запустите агента.");
                      return;
                    }
                    try {
                      setActionNotice(
                        "Запуск агента… поиск/оценка могут занять до нескольких минут."
                      );
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
                            setActionNotice(
                              status.paused_for_human
                                ? "Агент ждёт подтверждения человеком"
                                : `Агент: ${
                                    agentStageLabel(status.stage, "") ||
                                    agentStatusLabel(status.status, "готово")
                                  }`
                            );
                            if (status.paused_for_human) setHitlOpen(true);
                          },
                          onError: (err) =>
                            setActionNotice(
                              mutationError([{ error: err }]) || "Не удалось запустить агента"
                            )
                        }
                      );
                    } catch (err) {
                      setActionNotice(
                        err instanceof Error
                          ? err.message
                          : "Сбой обработчика «Запустить агента»"
                      );
                    }
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
                    <ShieldCheck size={15} /> Открыть согласование
                  </button>
                )}
                <button
                  className={styles.secondary}
                  disabled={runStrategy.isPending}
                  onClick={() => {
                    try {
                      const activeIds = allCases
                        .filter((item) => deriveFulfillment(item).status !== "completed")
                        .map((item) => item.id);
                      if (!activeIds.length) {
                        setActionNotice("Очередь пуста — нет заказов для оптимизации");
                        return;
                      }
                      setActionNotice(
                        "Запуск политики очереди… оптимизация может занять несколько минут."
                      );
                      runStrategy.mutate(
                        {
                          idempotency_key: key("strategy-run"),
                          allow_web_fallback: true,
                          case_ids: activeIds
                        },
                        {
                          onSuccess: (status) => {
                            setTab("policy");
                            setActionNotice(
                              status.paused_for_human
                                ? "Политика очереди ждёт согласования"
                                : `Оптимизация: ${
                                    agentStageLabel(status.stage, "") ||
                                    agentStatusLabel(status.status, "готово")
                                  }`
                            );
                            if (status.paused_for_human) setStrategyHitlOpen(true);
                          },
                          onError: (err) =>
                            setActionNotice(
                              mutationError([{ error: err }]) ||
                                "Не удалось запустить политику очереди"
                            )
                        }
                      );
                    } catch (err) {
                      setActionNotice(
                        err instanceof Error
                          ? err.message
                          : "Сбой обработчика «Политика очереди»"
                      );
                    }
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
                    <ShieldCheck size={15} /> Согласование политики
                  </button>
                ) : null}
              </div>
              {runAgent.isPending || runStrategy.isPending || searchSuppliers.isPending ? (
                <div className={styles.notice} role="status">
                  <Loader2 className={styles.spin} size={15} />
                  {runAgent.isPending
                    ? "Агент выполняется… не закрывайте страницу."
                    : runStrategy.isPending
                      ? "Политика очереди выполняется…"
                      : "Веб-поиск поставщиков выполняется…"}
                </div>
              ) : null}
              {actionNotice ? <div className={styles.notice}>{actionNotice}</div> : null}
              {error ? (
                <div className={styles.error}>
                  <AlertTriangle size={17} /> {error}
                </div>
              ) : null}
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
                    {agentStageLabel(strategyStatus?.stage, "не запущена")} ·{" "}
                    {agentStatusLabel(strategyStatus?.status, "—")}
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
                        Черновиков заказов:{" "}
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
                    disabled={searchSuppliers.isPending || !caseId}
                    onClick={() => {
                      if (!caseId) {
                        setActionNotice("Выберите заказ слева, затем найдите поставщиков.");
                        return;
                      }
                      try {
                        setActionNotice(
                          "Веб-поиск поставщиков… обычно 30–180 с (браузер Edge/Chrome)."
                        );
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
                            onSuccess: (result: SupplierSearchResult) => {
                              setSearchInfo({
                                query: result.query,
                                sources: result.sources_used,
                                web: result.web_fallback_used,
                                nomenclatureResults: result.nomenclature_results ?? []
                              });
                              if (result.status === "failed" || result.message) {
                                setActionNotice(
                                  result.message ||
                                    "Веб-поиск не вернул поставщиков. Проверьте браузер (Edge/Chrome)."
                                );
                              } else if (
                                !(result.suppliers?.length || result.nomenclature_results?.length)
                              ) {
                                setActionNotice(
                                  "Веб-поиск завершён без результатов по номенклатуре."
                                );
                              } else {
                                setActionNotice(
                                  `Найдено поставщиков: ${result.suppliers?.length ?? 0}` +
                                    (result.nomenclature_results?.length
                                      ? ` · позиций: ${result.nomenclature_results.length}`
                                      : "")
                                );
                              }
                            },
                            onError: (err) =>
                              setActionNotice(
                                mutationError([{ error: err }]) ||
                                  "Ошибка веб-поиска поставщиков"
                              )
                          }
                        );
                      } catch (err) {
                        setActionNotice(
                          err instanceof Error
                            ? err.message
                            : "Сбой обработчика «Найти поставщиков»"
                        );
                      }
                    }}
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
                    {searchInfo.sources.map(sourceBadgeLabel).join(", ") || "нет"} · веб:{" "}
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
                                ? " · веб"
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
                                      {supplier.abc_class ? (
                                        <span
                                          className={`${styles.badge} ${
                                            supplier.abc_class === "A"
                                              ? styles.badgeAbcA
                                              : supplier.abc_class === "B"
                                                ? styles.badgeAbcB
                                                : styles.badgeAbcC
                                          }`}
                                          title="ABC-класс по объёму закупок за 12 мес."
                                        >
                                          ABC {supplier.abc_class}
                                        </span>
                                      ) : null}
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
                          {supplier.abc_class ? (
                            <span
                              className={`${styles.badge} ${
                                supplier.abc_class === "A"
                                  ? styles.badgeAbcA
                                  : supplier.abc_class === "B"
                                    ? styles.badgeAbcB
                                    : styles.badgeAbcC
                              }`}
                              title="ABC-класс по объёму закупок за 12 мес."
                            >
                              ABC {supplier.abc_class}
                            </span>
                          ) : null}
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
                    1С / внутренние + веб только после согласования
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
                        Смета появится после «Запустить агента» и подтверждения списка
                        поставщиков. Неодобренный веб в смету не входит.
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
                        веб в смете:{" "}
                        {estimate.web_approved || estimate.kpi_flags?.web_included
                          ? "да (одобрен)"
                          : "нет"}
                        {estimate.excluded_unapproved_web
                          ? " · неодобренный веб исключён"
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
                                    .map((offer) => {
                                      const bits = [
                                        offer.optimization_rank != null
                                          ? `#${offer.optimization_rank}`
                                          : null,
                                        offer.supplier_name || offer.supplier_id,
                                        offer.source
                                          ? `[${sourceBadgeLabel(offer.source)}]`
                                          : null,
                                        offer.meets_deadline === false
                                          ? "риск срока"
                                          : offer.meets_deadline === true
                                            ? "в срок"
                                            : null
                                      ].filter(Boolean);
                                      return bits.join(" ");
                                    })
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
                        <span className={styles.badge}>
                          {agentStatusLabel(draft.status)}
                        </span>
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
                        <span className={styles.badge}>
                          {agentStatusLabel(draft.status)}
                        </span>
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
                          <td>
                            {labelRu(item.event_type, SHIPMENT_EVENT_LABEL_RU)}
                          </td>
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
                    ID согласования
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
                          {labelRu(item.event_type, SHIPMENT_EVENT_LABEL_RU)} ·{" "}
                          {formatDateTime(item.occurred_at)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Доказательства, через запятую
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
                        <strong>
                          Согласование:{" "}
                          {labelRu(item.operation, APPROVAL_OPERATION_LABEL_RU)}
                        </strong>
                        <span className={styles.badge}>
                          {agentStatusLabel(item.status)}
                        </span>
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
