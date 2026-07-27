import type {
  ProcurementCaseDetail,
  ProcurementCaseSummary,
  ProcurementDashboard,
  ProcurementTimelineEntry
} from "./procurement";

export type ProcurementManagerDashboard = ProcurementDashboard;

export interface Supplier {
  supplier_id: string;
  name: string;
  tax_id?: string | null;
  source: "1c" | "internal" | "web";
  categories: string[];
  quality_rating: number;
  delivery_rating: number;
  commercial_rating: number;
  is_active: boolean;
  contacts: Record<string, string>;
  evidence: string[];
  url?: string | null;
  city?: string | null;
  unit_price?: number | string | null;
  approx_cost?: number | string | null;
  rating?: number | string | null;
  abc_class?: "A" | "B" | "C" | null;
  abc_spend_share?: number | string | null;
}

export interface NomenclatureSearchItem {
  nomenclature_id?: string | null;
  nomenclature_name?: string | null;
  query?: string | null;
  existing_suppliers?: Supplier[];
}

export interface NomenclatureSupplierResult {
  nomenclature_id?: string | null;
  nomenclature_name?: string | null;
  query: string;
  suppliers: Supplier[];
  sources_used: string[];
  web_fallback_used: boolean;
}

export interface SupplierSearchRequest {
  query?: string;
  category?: string;
  limit?: number;
  allow_web_fallback?: boolean;
  /** Manual «Найти поставщиков»: bank seeds must not block live web search. */
  force_web?: boolean;
  mode?: "auto" | "manual_web";
  idempotency_key?: string;
  nomenclatures?: NomenclatureSearchItem[];
}

export interface SupplierSearchResult {
  query: string;
  suppliers: Supplier[];
  sources_used: string[];
  web_fallback_used: boolean;
  nomenclature_results?: NomenclatureSupplierResult[];
  operation_id?: string | null;
  pending?: boolean;
  status?: "completed" | "running" | "failed";
  message?: string | null;
  diagnostics?: Record<string, unknown>;
}

export interface RfqLine {
  line_id: string;
  nomenclature_id?: string | null;
  description: string;
  quantity: number;
  unit: string;
  required_date?: string | null;
}

export interface RfqDraft {
  rfq_id: string;
  supplier_ids: string[];
  lines: RfqLine[];
  subject: string;
  body: string;
  status: "draft";
  created_at: string;
}

export interface QuoteLine {
  line_id: string;
  unit_price: number;
  quantity: number;
  delivery_days: number;
  compliant: boolean;
}

export interface SupplierQuote {
  quote_id: string;
  supplier_id: string;
  rfq_id?: string | null;
  currency: string;
  lines: QuoteLine[];
  valid_until?: string | null;
  payment_terms?: string | null;
  warranty_months: number;
  quality_score: number;
  risk_score: number;
  received_at?: string | null;
}

export interface ComparisonWeights {
  price: number;
  delivery: number;
  quality: number;
  risk: number;
}

export interface QuoteScore {
  quote_id: string;
  supplier_id: string;
  total: number;
  price_score: number;
  delivery_score: number;
  quality_score: number;
  risk_score: number;
  final_score: number;
  rank: number;
  eligible: boolean;
  reasons: string[];
}

export interface QuoteComparison {
  weights: ComparisonWeights;
  scores: QuoteScore[];
  recommended_quote_id?: string | null;
  generated_at: string;
}

export interface PaymentDocumentDraft {
  id?: string | null;
  number?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  supplier_name?: string | null;
  document_url?: string | null;
  note?: string | null;
}

export type ApprovalOperation =
  | "select_supplier"
  | "approve_price"
  | "send_rfq"
  | "create_supplier_order"
  | "update_supplier_order"
  | "record_shipment";

export interface ApprovalRecord {
  approval_id: string;
  operation: ApprovalOperation;
  status: "requested" | "approved" | "rejected";
  comment?: string | null;
  actor_user_id?: string | null;
  created_at: string;
}

export interface ShipmentEvent {
  event_id: string;
  event_type: "ordered" | "dispatched" | "in_transit" | "delayed" | "received";
  occurred_at: string;
  supplier_id?: string | null;
  tracking_number?: string | null;
  details: Record<string, unknown>;
}

export interface Nonconformity {
  nonconformity_id: string;
  shipment_event_id?: string | null;
  description: string;
  severity: "minor" | "major" | "critical";
  quantity_affected?: number | null;
  evidence: string[];
  created_at: string;
}

export type OrderCoverageTone = "ready" | "attention" | "uncovered";

export type FulfillmentStatus =
  | "no_supplier"
  | "payment"
  | "delivery"
  | "otk_presentation"
  | "posting"
  | "completed";

export type FulfillmentTone = "yellow_blink" | "blue" | "yellow" | "green" | "muted";

export interface PurchaseBatch {
  batch_no: number;
  line_id: string;
  quantity: number;
  required_date?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  coverage_source: "warehouse" | "supplier" | "mixed" | "none" | string;
  unit_price?: number | null;
  planned_arrival?: string | null;
  supplier_lead_days?: number | null;
  supplier_ship_date?: string | null;
  meets_deadline?: boolean | null;
  unit?: string | null;
  piece_index?: number | null;
  piece_label?: string | null;
  is_meter_piece?: boolean;
}

export interface LineSchedule {
  supplier_lead_days?: number | null;
  supplier_ship_date?: string | null;
  planned_arrival?: string | null;
  required_date?: string | null;
  meets_deadline?: boolean | null;
  deadline_risk?: boolean;
  formula?: string;
  batch_no?: number | null;
}

export interface LineScheduleUpdatePayload {
  lead_days?: number | null;
  ship_date?: string | null;
  required_date?: string | null;
  batch_no?: number | null;
  idempotency_key?: string;
}

export interface FulfillmentStatusUpdatePayload {
  fulfillment_status: FulfillmentStatus;
  idempotency_key?: string;
}
export type CoverageSource = "warehouse" | "supplier" | "mixed" | "none";

export interface UsedSupplierPart {
  supplier_id: string;
  supplier_name: string;
  quantity: string | number;
}

export interface OrderCoverageLine {
  case_id: string;
  line_id: string;
  nomenclature_id?: string | null;
  nomenclature_name?: string | null;
  unit?: string | null;
  required_date?: string | null;
  needed_quantity: string;
  covered_quantity: string;
  deficit_quantity: string;
  from_warehouse: string;
  from_supplier: string;
  coverage_source: CoverageSource;
  coverage_source_label: string;
  tone: OrderCoverageTone;
  label: string;
  /** Suppliers that allocation actually used for this line's remainder. */
  supplier_parts?: UsedSupplierPart[];
  used_suppliers?: UsedSupplierPart[];
  warehouse_parts?: Array<{
    stock_id?: string;
    warehouse_id?: string;
    warehouse_name?: string | null;
    quantity: string | number;
  }>;
}

export interface OrderCoverageStatus {
  tone: OrderCoverageTone;
  label: string;
  covered_count: number;
  positions_count: number;
  uncovered_positions_count?: number;
  has_suppliers: boolean;
  needed_quantity?: string;
  covered_quantity?: string;
  deficit_quantity?: string;
  lines?: OrderCoverageLine[];
}

export interface MaterialAllocationSummary {
  total_orders_count: number;
  uncovered_orders_count: number;
  ready_orders_count: number;
  attention_orders_count: number;
  uncovered_positions_count: number;
  positions_count: number;
  need_quantity_total: string | number;
  covered_quantity_total: string | number;
  bank_quantity_total: string | number;
  active_suppliers_count: number;
  warehouses_count: number;
}

export interface MaterialAllocationResult {
  cases: Array<Record<string, unknown>>;
  lines: OrderCoverageLine[];
  by_nomenclature: Array<{
    nomenclature_id?: string | null;
    nomenclature_name?: string | null;
    unit?: string | null;
    needed_quantity: string;
    covered_quantity: string;
    deficit_quantity: string;
    from_warehouse: string;
    from_supplier: string;
    positions_count: number;
    coverage_source: CoverageSource;
    coverage_source_label: string;
    price_min?: string | number | null;
    price_max?: string | number | null;
    estimated_amount?: string | number | null;
    amount?: string | number | null;
    amount_source?: string;
    amount_formula?: string;
  }>;
  summary: MaterialAllocationSummary;
  price_formula?: string;
}

export interface NomenclaturePriceBound {
  nomenclature_id: string;
  nomenclature_name?: string | null;
  price_min: string | number;
  price_max: string | number;
  offer_count?: number;
  suppliers_count?: number;
}

export interface MaterialBankResponse {
  warehouses: Array<Record<string, unknown>>;
  stock: Array<Record<string, unknown>>;
  suppliers: Array<Record<string, unknown>>;
  materials: Array<Record<string, unknown>>;
  price_bounds?: NomenclaturePriceBound[];
  totals: {
    warehouses_count: number;
    suppliers_count: number;
    stock_lines_count: number;
    warehouse_quantity_total: string | number;
    supplier_quantity_total: string | number;
    bank_quantity_total: string | number;
  };
}

export interface TopSupplierOffer {
  rank: number;
  supplier_id: string;
  supplier_name: string;
  source?: string | null;
  nomenclature_id?: string | null;
  nomenclature_name?: string | null;
  unit_price: string | number;
  available_qty: string | number;
  coverable_qty: string | number;
  coverage_ratio: string | number;
  coverage_cost: string | number;
  total_cost?: string | number | null;
  overpay?: string | number | null;
  price_score?: string | number | null;
  coverage_score?: string | number | null;
  score: string | number;
  reason?: string;
  unit?: string;
  lead_time_days?: number | null;
  meets_deadline?: boolean | null;
  deadline_status?: "ok" | "miss" | "unknown" | null;
  deadline_risk?: boolean;
  optimization_rank?: number | null;
  optimization_reason?: string | null;
}

export interface SupplierOffersResponse {
  nomenclature_id: string;
  nomenclature_name?: string | null;
  need_qty: string | number;
  unit?: string;
  price_min?: string | number | null;
  price_max?: string | number | null;
  score_formula: string;
  top_suppliers: TopSupplierOffer[];
}

export interface AllPositionsRow {
  nomenclature_id?: string | null;
  nomenclature_name?: string | null;
  unit: string;
  quantity: string | number;
  price_min?: string | number | null;
  price_max?: string | number | null;
  avg_unit_price?: string | number | null;
  estimated_amount?: string | number | null;
  amount?: string | number | null;
  overpay?: string | number | null;
  amount_source?: string;
  amount_formula?: string | null;
  currency?: string;
  coverage_source?: CoverageSource | null;
  coverage_source_label?: string | null;
  from_warehouse?: string | number | null;
  from_supplier?: string | number | null;
  positions_count?: number;
  has_manual_override?: boolean;
  top_suppliers?: TopSupplierOffer[];
  /** Suppliers actually used by allocation (empty when fully warehouse). */
  used_suppliers?: UsedSupplierPart[];
  supplier_parts?: UsedSupplierPart[];
  /** Earliest required delivery date among aggregated open lines. */
  required_date?: string | null;
}

export interface AllPositionsResponse {
  rows: AllPositionsRow[];
  total_estimated_amount?: string | number | null;
  currency?: string;
  amount_formula: string;
  price_formula?: string | null;
  score_formula?: string | null;
}

export interface ProcurementManagerCaseSummary extends ProcurementCaseSummary {
  queue_bucket?: "new" | "supplier_search" | "quotes" | "approval" | "delivery" | string;
  project_price?: number | null;
  currency?: string | null;
  procurement_manager?: Record<string, unknown> | null;
  suppliers?: Supplier[];
  quotes?: Array<SupplierQuote | { quote?: SupplierQuote | null }>;
  recommendation?: RecommendationRecord | null;
  order_coverage?: OrderCoverageStatus | null;
  coverage?: OrderCoverageStatus | null;
  fulfillment_status?: FulfillmentStatus | null;
  fulfillment_label?: string | null;
  fulfillment_tone?: FulfillmentTone | string | null;
  show_otk_button?: boolean;
  is_completed?: boolean;
}

export interface LineAmountEntry {
  line_id: string;
  unit_price?: number | null;
  amount?: number | null;
  currency?: string;
}

export interface LineAmountsUpdatePayload {
  lines: LineAmountEntry[];
  idempotency_key?: string;
}

export interface ProcurementManagerWorkspaceSummary {
  uncovered_orders_count: number;
  active_suppliers_count: number;
  /** Count of line items with zero coverage (not qty sum). */
  uncovered_positions_count: number;
  /** Compat alias of uncovered_positions_count. */
  nomenclature_count: number;
  total_orders_count: number;
  ready_orders_count?: number;
  attention_orders_count?: number;
  positions_count?: number;
  need_quantity_total?: string | number;
  bank_quantity_total?: string | number;
  warehouses_count?: number;
  generated_at: string;
}

export interface ProcurementSyncFrom1CResult {
  status: string;
  mode: "poll" | "cache" | string;
  summary: Record<string, unknown>;
}

export interface ProcurementManagerCaseDetail
  extends Omit<ProcurementCaseDetail, "timeline"> {
  timeline: ProcurementTimelineEntry[];
  need_title?: string | null;
  need_description?: string | null;
  project_price?: number | null;
  currency?: string | null;
  suppliers: Supplier[];
  supplier_searches: SupplierSearchResult[];
  nomenclature_results?: NomenclatureSupplierResult[];
  quotes: SupplierQuote[];
  comparison: QuoteComparison | null;
  rfq_drafts: RfqDraft[];
  purchase_order_drafts?: PurchaseOrderDraft[] | Array<{ draft?: PurchaseOrderDraft }>;
  approvals: ApprovalRecord[];
  shipment_events: ShipmentEvent[];
  payment_document_draft?: PaymentDocumentDraft | null;
  recommendation?: RecommendationRecord | null;
  recommendation_audit: Record<string, unknown>[];
  operations: OperationStatus[];
  nonconformities: Nonconformity[];
  line_amounts?: Record<string, LineAmountEntry>;
  order_coverage?: OrderCoverageStatus | null;
  coverage?: OrderCoverageStatus | null;
  material_allocation?: { summary?: MaterialAllocationSummary | null } | null;
  lifecycle_state?: string | null;
  agent_stage?: string | null;
  paused_for_human?: boolean;
  agent_interrupt?: { type?: string; [key: string]: unknown } | null;
  evaluation?: AgentStatus["evaluation"];
  kpi_flags?: Record<string, unknown>;
  batches?: PurchaseBatch[];
  line_schedules?: Record<string, LineSchedule>;
  fulfillment_status?: FulfillmentStatus | null;
  fulfillment_label?: string | null;
  fulfillment_tone?: FulfillmentTone | string | null;
  show_otk_button?: boolean;
  is_completed?: boolean;
  otk_presentation_id?: string | null;
}

export interface OperationStatus {
  operation_id: string;
  case_id?: string | null;
  operation: string;
  status: "draft" | "approval_required" | "approved" | "executed" | "rejected" | "failed";
  approval_id?: string | null;
  external_ref?: string | null;
  error?: string | null;
  updated_at: string;
}

export interface CreateRfqDraftPayload {
  supplier_ids: string[];
  lines: RfqLine[];
  response_deadline?: string;
  delivery_address?: string;
  terms?: string[];
  idempotency_key: string;
}

export interface CaptureQuotePayload {
  quote: SupplierQuote;
  idempotency_key: string;
}

export interface RecommendationPayload {
  supplier_id: string;
  quote_id: string;
  rationale?: string;
  supplier_selection_approval_id?: string;
  price_approval_id?: string;
  idempotency_key: string;
}

export interface ApprovalPayload {
  approval_id?: string;
  operation: ApprovalOperation;
  status: "requested" | "approved" | "rejected";
  comment?: string;
  idempotency_key: string;
}

export interface ShipmentEventPayload {
  event: ShipmentEvent;
  approval_id: string;
  idempotency_key: string;
}

export interface NonconformityPayload {
  nonconformity: Nonconformity;
  idempotency_key: string;
}

export interface RecommendationRecord {
  recommendation_id: string;
  supplier_id: string;
  quote_id: string;
  total: number;
  currency: string;
  score?: number | null;
  rationale?: string | null;
  status: "approval_required" | "approved";
  supplier_selection_approval_id?: string | null;
  price_approval_id?: string | null;
  requires_human_approval: boolean;
  payment_execution_allowed: false;
  created_at: string;
}

export interface PurchaseOrderLine {
  line_id: string;
  nomenclature_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  delivery_days: number;
}

export interface PurchaseOrderDraft {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  lines: PurchaseOrderLine[];
  currency: string;
  total: number;
  source_quote_id?: string | null;
  subject: string;
  body: string;
  status: "draft" | "approved_draft";
  payment_execution_allowed: false;
  created_at: string;
}

export type AgentResumeAction =
  | "approve_shortlist"
  | "approve_rfq_draft"
  | "approve_order_draft"
  | "reject";

export type StrategyResumeAction =
  | "approve_shortlist"
  | "approve_policy"
  | "approve_rfq_draft"
  | "approve_order_draft"
  | "reject";

export interface AgentRunPayload {
  idempotency_key?: string;
  allow_web_fallback?: boolean;
  query?: string;
}

export interface AgentResumePayload {
  action: AgentResumeAction;
  comment?: string;
  idempotency_key?: string;
}

export interface StrategyRunPayload {
  idempotency_key?: string;
  allow_web_fallback?: boolean;
  query?: string;
  case_ids?: string[];
}

export interface StrategyResumePayload {
  action: StrategyResumeAction;
  comment?: string;
  idempotency_key?: string;
}

export interface StrategyStatus {
  run_id?: string | null;
  stage?: string | null;
  status?: string | null;
  paused_for_human: boolean;
  interrupt_type?: string | null;
  case_ids?: string[];
  waves?: {
    waves?: Array<{
      wave_id?: string;
      label?: string;
      mode?: string;
      case_ids?: string[];
      reason?: string;
    }>;
    case_wave?: Record<string, string>;
    explanation?: string;
  } | null;
  supply_policy?: Record<string, unknown> | null;
  explanation?: {
    summary?: string;
    tradeoffs?: string[];
    text?: string;
    [key: string]: unknown;
  } | null;
  cost_estimate?: AgentCostEstimate | null;
  purchase_order_drafts?: PurchaseOrderDraft[];
  queue_plan_summary?: Record<string, unknown> | null;
  supplier_diversity?: Array<{
    case_id?: string;
    line_id?: string;
    nomenclature_id?: string;
    nomenclature_name?: string;
    urgent_supplier_id?: string;
    economy_supplier_id?: string;
    reason?: string;
  }>;
  kpi_flags?: Record<string, unknown>;
  candidates_count?: number;
  payment_execution_allowed?: boolean;
}

export interface AgentCostEstimate {
  lines?: Array<{
    line_id?: string;
    nomenclature_id?: string;
    nomenclature_name?: string;
    need_qty?: string | number;
    estimated_amount?: string | number | null;
    avg_unit_price?: string | number | null;
    top_suppliers?: TopSupplierOffer[];
    recommended_supplier_id?: string | null;
    estimate_sources?: string[];
  }>;
  total_estimated_amount?: string | number | null;
  web_approved?: boolean;
  trusted_supplier_ids?: string[];
  approved_web_supplier_ids?: string[];
  excluded_unapproved_web?: boolean;
  amount_formula?: string;
  kpi_flags?: Record<string, unknown>;
}

export interface AgentStatus {
  case_id: string;
  stage?: string | null;
  status?: string | null;
  paused_for_human: boolean;
  interrupt_type?: string | null;
  recommendation?: Record<string, unknown> | null;
  evaluation?: {
    lines?: Array<{
      line_id?: string;
      nomenclature_id?: string;
      nomenclature_name?: string;
      need_qty?: string | number;
      price_min?: string | number | null;
      price_max?: string | number | null;
      avg_unit_price?: string | number | null;
      estimated_amount?: string | number | null;
      overpay?: string | number | null;
      amount_source?: string;
      top_suppliers?: TopSupplierOffer[];
      recommended_supplier_id?: string | null;
    }>;
    primary_supplier_id?: string | null;
    recommended_supplier_ids?: string[];
    amount_formula?: string;
    kpi_flags?: Record<string, unknown>;
    cost_estimate?: AgentCostEstimate;
  } | null;
  cost_estimate?: AgentCostEstimate | null;
  rfq_draft?: RfqDraft | null;
  purchase_order_draft?: PurchaseOrderDraft | null;
  comparison?: QuoteComparison | null;
  kpi_flags: Record<string, unknown>;
  candidates_count: number;
  payment_execution_allowed: false;
}
