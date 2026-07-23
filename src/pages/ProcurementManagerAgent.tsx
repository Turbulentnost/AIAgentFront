import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueries } from "@tanstack/react-query";
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
  useResumeProcurementAgent,
  useRunProcurementAgent,
  useSearchProcurementSuppliers,
  useSubmitProcurementApproval,
  useSyncProcurementFrom1C,
  useUpdateProcurementLineAmounts
} from "@/hooks/useProcurementManager";
import type {
  AgentResumeAction,
  AgentStatus,
  ApprovalOperation,
  ApprovalRecord,
  LineAmountEntry,
  OrderCoverageStatus,
  OrderCoverageTone,
  ProcurementManagerCaseDetail,
  ProcurementManagerCaseSummary,
  PurchaseOrderDraft,
  QuoteScore,
  Supplier,
  SupplierQuote,
  TopSupplierOffer
} from "@/types/procurementManager";
import type { ProcurementCasePosition } from "@/types/procurement";
import {
  caseTitle,
  formatDateTime,
  formatQuantity
} from "@/utils/procurementDashboard";
import styles from "./ProcurementManagerAgent.module.css";

const AGENT_ID = "procurement_logistics_agent";
type Tab = "suppliers" | "quotes" | "rfq" | "order" | "delivery" | "audit";
type ConfirmAction =
  | { type: "supplier"; supplier: Supplier }
  | { type: "price"; score: QuoteScore }
  | { type: "rfq"; rfqId: string };

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "suppliers", label: "Поставщики" },
  { id: "quotes", label: "Сравнение КП" },
  { id: "rfq", label: "RFQ" },
  { id: "order", label: "Заказ" },
  { id: "delivery", label: "Поставка" },
  { id: "audit", label: "HITL / Аудит" }
];

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
            : "Подтвердить shortlist / RFQ?"}
        </h3>
        <p>
          {isOrder
            ? "Агент подготовил черновик заказа поставщику. Оплата и отправка в 1С запрещены."
            : "Агент ранжировал поставщиков и подготовил RFQ. Подтвердите shortlist для продолжения."}
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

function unwrapQuotes(
  raw: ProcurementManagerCaseSummary["quotes"] | SupplierQuote[] | undefined
): SupplierQuote[] {
  if (!raw?.length) return [];
  const out: SupplierQuote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    if ("lines" in item && Array.isArray((item as SupplierQuote).lines)) {
      out.push(item as SupplierQuote);
      continue;
    }
    const nested = (item as { quote?: SupplierQuote | null }).quote;
    if (nested && Array.isArray(nested.lines)) out.push(nested);
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

function storedUnitPrice(
  position: ProcurementCasePosition,
  stored: LineAmountEntry | undefined
): number | null {
  if (stored?.unit_price != null && Number.isFinite(stored.unit_price)) {
    return stored.unit_price;
  }
  if (stored?.amount != null && Number.isFinite(stored.amount)) {
    const qty = Number(position.quantity);
    if (Number.isFinite(qty) && qty > 0) return stored.amount / qty;
  }
  return null;
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
      return "Маршрут запуска агента недоступен (404). Перезапустите backend на порту из VITE_API_SERVER.";
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

function TopSuppliersBlock({
  offers,
  currency = "RUB"
}: {
  offers: TopSupplierOffer[];
  currency?: string;
}) {
  if (!offers.length) {
    return <span className={styles.muted}>Нет предложений</span>;
  }
  return (
    <ol className={styles.topSuppliers}>
      {offers.map((offer) => {
        const price = toFiniteNumber(offer.unit_price);
        const available = toFiniteNumber(offer.available_qty);
        const coverable = toFiniteNumber(offer.coverable_qty);
        const cost = toFiniteNumber(offer.coverage_cost);
        const score = toFiniteNumber(offer.score);
        return (
          <li key={`${offer.rank}-${offer.supplier_id}`}>
            <strong>
              #{offer.rank} {offer.supplier_name}
            </strong>
            <span>
              {price == null
                ? "—"
                : price.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}{" "}
              · дост. {available ?? "—"} · покр. {coverable ?? "—"} ·{" "}
              {formatMoney(cost, currency)}
              {score != null
                ? ` · score ${score.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}`
                : ""}
            </span>
            {offer.reason ? (
              <small className={styles.muted}>{offer.reason}</small>
            ) : null}
          </li>
        );
      })}
    </ol>
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
        : `передачу черновика ${action.rfqId} в контур отправки`;
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
  } | null>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [showAllPositions, setShowAllPositions] = useState(false);

  const permissions = useProcurementManagerPermissions();
  const canAccess = permissions.data?.accessible_role_agents?.includes(AGENT_ID) ?? false;
  const dashboard = useProcurementManagerDashboard(canAccess);
  const summary = useProcurementManagerWorkspaceSummary(canAccess);
  const allPositions = useProcurementManagerAllPositions(canAccess && showAllPositions);
  const cases = useMemo(
    () =>
      (dashboard.data?.groups.flatMap((group) => group.cases) ??
        []) as ProcurementManagerCaseSummary[],
    [dashboard.data]
  );
  const caseId = params.get("case") || "";
  const detail = useProcurementManagerCase(caseId || null, canAccess);
  const suppliersQuery = useProcurementManagerSuppliers(caseId || null, canAccess);
  const comparisonQuery = useProcurementManagerComparison(caseId || null, canAccess);
  const agentStatusQuery = useProcurementManagerAgentStatus(caseId || null, canAccess);
  const poDraftsQuery = useProcurementManagerPurchaseOrderDrafts(caseId || null, canAccess);

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
  const [hitlOpen, setHitlOpen] = useState(true);

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
  const comparison = comparisonQuery.data ?? workspace?.comparison;
  const quotes = workspace?.quotes ?? [];
  const quoteById = new Map(quotes.map((quote) => [quote.quote_id, quote]));
  const supplierById = new Map(suppliers.map((supplier) => [supplier.supplier_id, supplier]));
  const agentStatus = agentStatusQuery.data;
  const poDrafts = unwrapPurchaseOrderDrafts(
    poDraftsQuery.data ?? workspace?.purchase_order_drafts
  );
  const topSuppliersPreview =
    agentStatus?.evaluation?.lines?.[0]?.top_suppliers?.slice(0, 3) ??
    workspace?.evaluation?.lines?.[0]?.top_suppliers?.slice(0, 3) ??
    [];

  useEffect(() => {
    if (!workspace) return;
    const next: Record<string, string> = {};
    for (const position of workspace.positions) {
      const price = storedUnitPrice(position, workspace.line_amounts?.[position.line_id]);
      if (price != null) next[position.line_id] = String(price);
    }
    setDraftPrices(next);
  }, [workspace]);

  const quoteUnitPrices = useMemo(() => {
    const prices = new Map<string, number>();
    for (const quote of quotes) {
      for (const line of quote.lines) {
        if (!prices.has(line.line_id)) prices.set(line.line_id, line.unit_price);
      }
    }
    return prices;
  }, [quotes]);

  const positions = useMemo(
    () => (workspace?.positions ?? []).filter((item) => !item.cancelled),
    [workspace]
  );

  const lineRows = useMemo(() => {
    const coverageByLine = new Map(
      (workspace?.order_coverage?.lines ?? []).map((line) => [line.line_id, line])
    );
    return positions.map((position) => {
      const qty = Number(position.quantity);
      const hasDraft = Object.prototype.hasOwnProperty.call(draftPrices, position.line_id);
      const manualPrice = hasDraft ? parseDraftNumber(draftPrices[position.line_id]) : null;
      const quotePrice = quoteUnitPrices.get(position.line_id) ?? null;
      const unitPrice = hasDraft ? manualPrice : quotePrice;
      const cov = coverageByLine.get(position.line_id);
      const coverageSource = cov?.coverage_source ?? null;
      const fromSupplier = toFiniteNumber(cov?.from_supplier) ?? 0;
      let amount: number | null =
        unitPrice != null && Number.isFinite(qty) ? unitPrice * qty : null;
      // Warehouse stock is not purchased; mixed bills only supplier-covered qty.
      if (coverageSource === "warehouse") {
        amount = 0;
      } else if (
        coverageSource === "mixed" &&
        unitPrice != null &&
        Number.isFinite(fromSupplier)
      ) {
        amount = unitPrice * fromSupplier;
      }
      const source =
        coverageSource === "warehouse"
          ? "склад"
          : hasDraft
            ? manualPrice != null
              ? "вручную"
              : "—"
            : quotePrice != null
              ? "КП"
              : "—";
      return {
        position,
        qty,
        amount,
        unitPrice,
        source,
        currency: workspace?.line_amounts?.[position.line_id]?.currency || workspace?.currency || "RUB"
      };
    });
  }, [draftPrices, positions, quoteUnitPrices, workspace?.currency, workspace?.line_amounts, workspace?.order_coverage?.lines]);

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
        coverageSource: row.coverage_source_label || row.coverage_source || "—",
        amountFormula: row.amount_formula || allPositions.data?.amount_formula || "",
        hasManualOverride: Boolean(row.has_manual_override),
        topSuppliers: row.top_suppliers ?? []
      };
    });
  }, [allPositions.data, showAllPositions]);

  const orderOfferNeeds = useMemo(() => {
    if (showAllPositions || !caseId) return [] as Array<{ nomenclature: string; need_qty: number }>;
    const map = new Map<string, number>();
    for (const position of positions) {
      const nom = String(position.nomenclature_id || "").trim();
      if (!nom) continue;
      const qty = toFiniteNumber(position.quantity) ?? 0;
      if (qty <= 0) continue;
      map.set(nom, (map.get(nom) ?? 0) + qty);
    }
    return Array.from(map.entries()).map(([nomenclature, need_qty]) => ({
      nomenclature,
      need_qty
    }));
  }, [caseId, positions, showAllPositions]);

  const orderOfferQueries = useQueries({
    queries: orderOfferNeeds.map((item) => ({
      queryKey: [
        "procurement",
        "procurement-manager",
        "supplier-offers",
        caseId,
        item.nomenclature,
        item.need_qty
      ] as const,
      queryFn: () =>
        procurementManagerApi.getSupplierOffers(caseId!, {
          nomenclature: item.nomenclature,
          need_qty: item.need_qty,
          top_n: 3
        }),
      enabled: Boolean(canAccess && caseId && !showAllPositions),
      staleTime: 30_000
    }))
  });

  const orderTopByNom = useMemo(() => {
    const map = new Map<string, TopSupplierOffer[]>();
    orderOfferNeeds.forEach((item, index) => {
      const data = orderOfferQueries[index]?.data;
      if (data?.top_suppliers?.length) {
        map.set(item.nomenclature, data.top_suppliers);
      }
    });
    return map;
  }, [orderOfferNeeds, orderOfferQueries]);

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
    resumeAgent
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
        `Черновик RFQ: ${confirmAction.rfqId}. Только согласование, без отправки.`,
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
          <p>Заказы, номенклатура, поставщики, RFQ и согласования</p>
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
              const baseClass = item.id === caseId ? styles.caseActive : styles.case;
              return (
                <button
                  className={`${baseClass} ${COVERAGE_CASE_CLASS[coverage.tone]}`}
                  key={item.id}
                  onClick={() => setParams({ case: item.id })}
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
                    {item.positions_count} поз. · требуется {formatDateTime(item.required_date)}
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
                    disabled={downloadEstimate.isPending || !positions.length}
                    onClick={() => downloadEstimate.mutate(caseId)}
                    type="button"
                    title="Скачать Excel для сметы"
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
                        <th
                          title={
                            allPositions.data?.score_formula ||
                            "Топ-3: 0.55×price_score + 0.45×coverage_score"
                          }
                        >
                          Топ-3 поставщика
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {showAllPositions ? (
                        allPositions.isLoading || allPositions.isPending ? (
                          <tr>
                            <td colSpan={6}>
                              <Loader2 className={styles.spin} size={14} /> Загрузка позиций
                              очереди...
                            </td>
                          </tr>
                        ) : !aggregatedRows.length ? (
                          <tr>
                            <td colSpan={6}>Нет активных позиций в очереди.</td>
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
                              <td>{row.coverageSource}</td>
                              <td>
                                <TopSuppliersBlock
                                  currency={row.currency}
                                  offers={row.topSuppliers}
                                />
                              </td>
                            </tr>
                          ))
                        )
                      ) : !lineRows.length ? (
                        <tr>
                          <td colSpan={6}>Нет активных позиций.</td>
                        </tr>
                      ) : (
                        lineRows.map((row) => {
                          const cov = coverageByLineId.get(
                            `${workspace?.id}:${row.position.line_id}`
                          );
                          const coverageSource =
                            cov?.coverage_source_label || row.source;
                          const nomId = String(row.position.nomenclature_id || "").trim();
                          const topOffers = nomId
                            ? orderTopByNom.get(nomId) ?? []
                            : [];
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
                                  placeholder="0"
                                  step="0.01"
                                  type="number"
                                  value={draftPrices[row.position.line_id] ?? ""}
                                />
                              </td>
                              <td>{formatMoney(row.amount, row.currency)}</td>
                              <td>{coverageSource}</td>
                              <td>
                                <TopSuppliersBlock
                                  currency={row.currency}
                                  offers={topOffers}
                                />
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
              Поиск поставщиков, RFQ, сравнение КП, HITL и поставка
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
                  RFQ:{" "}
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
                    runAgent.mutate({
                      caseId,
                      payload: { idempotency_key: key("agent-run") }
                    });
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

            {tab === "suppliers" ? (
              <>
                <div className={styles.actions}>
                  <p className={styles.muted}>
                    Кандидаты с рейтингами и доказательствами происхождения.
                  </p>
                  <button
                    className={styles.primary}
                    disabled={searchSuppliers.isPending}
                    onClick={() =>
                      searchSuppliers.mutate(
                        { caseId, payload: { idempotency_key: key("supplier-search") } },
                        {
                          onSuccess: (result) =>
                            setSearchInfo({
                              query: result.query,
                              sources: result.sources_used,
                              web: result.web_fallback_used
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
                  </div>
                ) : null}
                {suppliersQuery.isLoading ? (
                  <div className={styles.empty}>
                    <Loader2 className={styles.spin} size={16} /> Загрузка...
                  </div>
                ) : null}
                {!suppliersQuery.isLoading && !suppliers.length ? (
                  <div className={styles.empty}>Кандидаты не найдены.</div>
                ) : null}
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
                        <span className={styles.badge}>{supplier.source}</span>
                      </div>
                      <p>ИНН: {supplier.tax_id || "—"}</p>
                      <p>
                        Качество {supplier.quality_rating} · доставка {supplier.delivery_rating} ·
                        коммерческий {supplier.commercial_rating}
                      </p>
                      <p className={styles.muted}>
                        {supplier.categories.join(", ") || "Категории не указаны"} ·{" "}
                        {supplier.is_active ? "активен" : "неактивен"}
                      </p>
                      <div className={styles.provenance}>
                        <strong>Evidence:</strong>
                        <br />
                        {supplier.evidence.length
                          ? supplier.evidence.join(" · ")
                          : "Нет подтверждений"}
                      </div>
                      <div className={styles.actions}>
                        <label>
                          <input
                            checked={selectedSupplierIds.includes(supplier.supplier_id)}
                            onChange={() => toggleSupplier(supplier.supplier_id)}
                            type="checkbox"
                          />{" "}
                          В RFQ
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
                    RFQ
                    <select name="rfq_id">
                      <option value="">Без RFQ</option>
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
                    Нельзя создать RFQ: в кейсе нет активных позиций с положительным количеством.
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
                      {workspace.shipment_events.map((item) => (
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
                      {workspace.shipment_events.map((item) => (
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
                {!workspace.timeline.length ? (
                  <div className={styles.empty}>Событий нет.</div>
                ) : (
                  workspace.timeline.map((entry) => (
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
                {workspace.approvals.map((item) => (
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
    </div>
  );
}
