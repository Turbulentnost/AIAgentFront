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
}

export interface SupplierSearchRequest {
  query?: string;
  category?: string;
  limit?: number;
  allow_web_fallback?: boolean;
  idempotency_key?: string;
}

export interface SupplierSearchResult {
  query: string;
  suppliers: Supplier[];
  sources_used: string[];
  web_fallback_used: boolean;
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
export type CoverageSource = "warehouse" | "supplier" | "mixed" | "none";

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
  nomenclature_id?: string | null;
  nomenclature_name?: string | null;
  unit_price: string | number;
  available_qty: string | number;
  coverable_qty: string | number;
  coverage_ratio: string | number;
  coverage_cost: string | number;
  price_score?: string | number | null;
  coverage_score?: string | number | null;
  score: string | number;
  reason?: string;
  unit?: string;
  lead_time_days?: number | null;
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
  positions_count?: number;
  has_manual_override?: boolean;
  top_suppliers?: TopSupplierOffer[];
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
  } | null;
  rfq_draft?: RfqDraft | null;
  purchase_order_draft?: PurchaseOrderDraft | null;
  comparison?: QuoteComparison | null;
  kpi_flags: Record<string, unknown>;
  candidates_count: number;
  payment_execution_allowed: false;
}
