export type ProcurementSourceType =
  | "internal_consumption_order"
  | "production_material_order"
  | "transfer_order"
  | "reorder_point";

export type ProcurementDashboardView = "active" | "processing" | "archive";

export interface ProcurementPermissions {
  can_access_orchestrator: boolean;
  can_access_role_workspace?: boolean;
  can_submit_role_result?: boolean;
  can_refresh: boolean;
  is_superuser: boolean;
  accessible_role_agents: string[];
}

export interface ProcurementCasePosition {
  id: string;
  line_id: string;
  line_number: number;
  nomenclature_id: string;
  nomenclature_name?: string | null;
  characteristic_id?: string | null;
  unit?: string | null;
  quantity: string;
  required_date?: string | null;
  supply_action?: string | null;
  cancelled: boolean;
}

export interface ProcurementCaseEvent {
  id: string;
  event_type: string;
  agent_id?: string | null;
  actor_role?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  payload: Record<string, unknown>;
  created_at?: string | null;
}

export type ProcurementStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "blocked"
  | "skipped";

export interface ProcurementRouteStage {
  stage_id: string;
  label: string;
  order: number;
  status: ProcurementStageStatus;
  summary?: string | null;
}

export interface ProcurementTimelineEntry {
  id?: string | null;
  at?: string | null;
  kind: string;
  title: string;
  detail?: string | null;
  actor_id?: string | null;
  actor_label?: string | null;
  stage_id?: string | null;
  status?: string | null;
  payload?: Record<string, unknown>;
}

export interface ProcurementCurrentState {
  status: string;
  control_point?: string | null;
  current_agent_id?: string | null;
  current_agent_label?: string | null;
  requires_human_review: boolean;
  summary?: string | null;
  task_id?: string | null;
  task_status?: string | null;
  wait_status?: string | null;
  wait_reason?: string | null;
  closed_reason?: string | null;
  closed_reason_label?: string | null;
  source_active: boolean;
}

export interface ProcurementCaseSummary {
  id: string;
  correlation_id: string;
  source_type: ProcurementSourceType | string;
  source_1c_ref: string;
  source_number?: string | null;
  source_date?: string | null;
  source_status?: string | null;
  source_synced_at?: string | null;
  source_basis_1c_ref?: string | null;
  source_basis_type?: string | null;
  source_basis_number?: string | null;
  source_basis_date?: string | null;
  source_basis_status?: string | null;
  status: string;
  control_point?: string | null;
  current_agent_id?: string | null;
  current_agent_name?: string | null;
  current_task_id?: string | null;
  required_date?: string | null;
  deadline_at?: string | null;
  positions_count: number;
  updated_at?: string | null;
  summary?: string | null;
  requires_human_review: boolean;
  closed_at?: string | null;
  closed_reason?: string | null;
  closed_reason_label?: string | null;
  reactivated_at?: string | null;
  source_active?: boolean;
  engineer_bucket?: "success" | "attention" | "critical" | null;
  engineer_bucket_reason?: string | null;
  engineer_work_status?: "processing" | "awaiting_action" | "completed" | "archived" | null;
  engineer_decision_kind?: "none" | "purchase_confirmation" | "critical_acknowledgement" | null;
  engineer_invoked_at?: string | null;
  engineer_workspace_archived_at?: string | null;
  engineer_action_at?: string | null;
  engineer_critical_acknowledged_at?: string | null;
  dispatcher_bucket?: "success" | "attention" | "critical" | null;
  dispatcher_bucket_reason?: string | null;
  dispatcher_work_status?: "processing" | "awaiting_action" | "completed" | "archived" | null;
  dispatcher_decision_kind?: "none" | "supply_confirmation" | "critical_acknowledgement" | null;
  dispatcher_invoked_at?: string | null;
  dispatcher_workspace_archived_at?: string | null;
  dispatcher_action_at?: string | null;
  dispatcher_critical_acknowledged_at?: string | null;
  dispatcher_stream?: "reorder_point" | "after_engineer" | null;
  department_name?: string | null;
  picker_bucket?: "success" | "attention" | "critical" | null;
  picker_bucket_reason?: string | null;
  picker_work_status?: "processing" | "awaiting_action" | "completed" | "archived" | null;
  picker_decision_kind?:
    | "none"
    | "stock_confirmation"
    | "deficit_confirmation"
    | "discrepancy_return"
    | "critical_acknowledgement"
    | null;
  picker_invoked_at?: string | null;
  picker_workspace_archived_at?: string | null;
  picker_action_at?: string | null;
  picker_critical_acknowledged_at?: string | null;
  /** Complex chief workspace (non-MU2); dashboard may also mirror these into picker_*. */
  complex_bucket?: "success" | "attention" | "critical" | null;
  complex_bucket_reason?: string | null;
  complex_work_status?: "processing" | "awaiting_action" | "completed" | "archived" | null;
  complex_decision_kind?:
    | "none"
    | "stock_confirmation"
    | "deficit_confirmation"
    | "discrepancy_return"
    | "critical_acknowledgement"
    | null;
  complex_invoked_at?: string | null;
  complex_workspace_archived_at?: string | null;
  complex_action_at?: string | null;
  complex_critical_acknowledged_at?: string | null;
  purchase_manager_bucket?: "success" | "attention" | "critical" | null;
  purchase_manager_bucket_reason?: string | null;
  purchase_manager_work_status?:
    | "processing"
    | "awaiting_action"
    | "completed"
    | "archived"
    | null;
  purchase_manager_decision_kind?:
    | "none"
    | "reconciliation_confirmation"
    | "critical_acknowledgement"
    | null;
  purchase_manager_invoked_at?: string | null;
  purchase_manager_workspace_archived_at?: string | null;
  purchase_manager_action_at?: string | null;
  purchase_manager_critical_acknowledged_at?: string | null;
  omto_bucket?: "success" | "attention" | "critical" | null;
  omto_bucket_reason?: string | null;
}

export interface ProductionPreparationEngineerAction {
  status: string;
  action:
    | "purchase_confirmed"
    | "critical_acknowledged"
    | "supply_confirmed"
    | "picker_confirmed";
  case_id: string;
}

export type WarehousePickerAction = ProductionPreparationEngineerAction;
export type WarehousePickerCaseDetail = ProcurementCaseDetail;
export type WarehousePickerDashboard = ProcurementDashboard;
export type WarehouseComplexChiefAction = WarehousePickerAction;
export type WarehouseComplexChiefCaseDetail = WarehousePickerCaseDetail;
export type WarehouseComplexChiefDashboard = WarehousePickerDashboard;

export interface WarehousePickerPosition {
  line_id: string;
  nomenclature_name: string;
  characteristic_name?: string | null;
  unit: string;
  requested_quantity: string | number;
  store_room_stock: string | number;
  warehouse_stock?: string | number;
  accounting_quantity: string | number;
  factual_quantity: string | number;
  available_for_issue: string | number;
  confirmed_available: string | number;
  confirmed_deficit: string | number;
  quantity_to_issue: string | number;
  quantity_to_purchase: string | number;
  reserved_other_quantity?: string | number;
  has_discrepancy: boolean;
  outcome: string;
  recommendation: string;
  warehouse_name?: string | null;
  assignment_id?: string | null;
  assignment_name?: string | null;
  formulas?: Record<string, string>;
  already_being_purchased?: boolean;
  supplier_order_numbers?: string[];
  ordered_quantity?: string | number | null;
  supplier_name?: string | null;
  arrival_date?: string | null;
  supplier_orders?: Array<{
    supplier_order_number?: string | null;
    quantity?: string | number | null;
    supplier_name?: string | null;
    arrival_date?: string | null;
  }>;
  excluded_supply?: Array<{
    supply_id?: string;
    source_type?: string;
    quantity?: string | number;
    warehouse_id?: string | null;
    assignment_id?: string | null;
    assignment_name?: string | null;
    reason?: string;
  }>;
}

export interface WarehousePickerOutput {
  summary: string;
  recommended_next_step: string;
  decision_kind:
    | "stock_confirmation"
    | "deficit_confirmation"
    | "discrepancy_return"
    | "critical_acknowledgement"
    | "none";
  calculated_at?: string;
  positions: WarehousePickerPosition[];
  case?: {
    source_number?: string | null;
    source_date?: string | null;
    source_status?: string | null;
    department_name?: string | null;
    warehouse_name?: string | null;
    production_order_number?: string | null;
    production_order_1c_ref?: string | null;
    required_date?: string | null;
  };
  conclusion?: {
    requested_quantity?: string;
    available_quantity?: string;
    confirmed_deficit?: string;
    quantity_to_issue?: string;
    quantity_to_purchase?: string;
    warehouse_name?: string;
  };
  missing_data?: string[];
  validation_issues?: Array<{ code: string; message: string }>;
  excluded_capabilities?: string[];
}

export type ProductionDispatcherAction = ProductionPreparationEngineerAction;
export type ProductionDispatcherCaseDetail = ProcurementCaseDetail;
export type ProductionDispatcherDashboard = ProcurementDashboard;

export type PurchaseManagerAction = ProductionPreparationEngineerAction;
export type PurchaseManagerCaseDetail = ProcurementCaseDetail;
export type PurchaseManagerDashboard = ProcurementDashboard;

export interface PurchaseManagerSupplierOrder {
  order_id?: string | null;
  order_number: string;
  order_date?: string | null;
  supplier_name?: string | null;
  status?: string | null;
  quantity: string | number;
  expected_date?: string | null;
  confirmed?: boolean;
}

export interface PurchaseManagerPosition {
  line_id: string;
  nomenclature_id?: string;
  nomenclature_name: string;
  characteristic_name?: string | null;
  unit: string;
  requested_quantity: string | number;
  ordered_quantity: string | number;
  remaining_quantity: string | number;
  is_reconciled: boolean;
  outcome: string;
  recommendation?: string;
  supplier_orders: PurchaseManagerSupplierOrder[];
}

export interface PurchaseManagerOutput {
  schema_version?: string;
  calculated_at?: string;
  summary: string;
  recommended_next_step: string;
  decision_kind: "reconciliation_confirmation" | "critical_acknowledgement" | "none";
  positions: PurchaseManagerPosition[];
  missing_data?: string[];
  validation_issues?: Array<{ code: string; message: string }>;
  excluded_capabilities?: string[];
}

export interface ProcurementCaseDetail extends ProcurementCaseSummary {
  source_entity_set?: string | null;
  source_database?: string | null;
  source_data_version?: string | null;
  initiator_1c_ref?: string | null;
  initiator_name?: string | null;
  department_1c_ref?: string | null;
  department_name?: string | null;
  warehouse_1c_ref?: string | null;
  warehouse_name?: string | null;
  warehouse_from_1c_ref?: string | null;
  warehouse_to_1c_ref?: string | null;
  organization_1c_ref?: string | null;
  priority_1c_ref?: string | null;
  assigned_agents: string[];
  deviation_summary?: string | null;
  latest_result?: Record<string, unknown> | null;
  case_metadata?: Record<string, unknown> | null;
  positions: ProcurementCasePosition[];
  events: ProcurementCaseEvent[];
  route_stages: ProcurementRouteStage[];
  timeline: ProcurementTimelineEntry[];
  current_state?: ProcurementCurrentState | null;
}

export interface ProcurementSyncStatus {
  source_type: ProcurementSourceType | string;
  label_ru: string;
  entity_set?: string | null;
  available: boolean;
  unavailable_reason?: string | null;
  capability_status: string;
  capability_message?: string | null;
  database_name?: string | null;
  last_polled_at?: string | null;
  last_success_at?: string | null;
  watermark_date?: string | null;
  last_error?: string | null;
  documents_seen: number;
  cases_created: number;
  cases_updated: number;
  cases_skipped: number;
}

export interface ProcurementSourceGroup {
  source_type: ProcurementSourceType | string;
  label_ru: string;
  entity_set?: string | null;
  available: boolean;
  unavailable_reason?: string | null;
  cases: ProcurementCaseSummary[];
  cases_count: number;
  sync: ProcurementSyncStatus;
}

export interface ProcurementDashboardCounts {
  active: number;
  processing: number;
  archive: number;
}

export interface ProcurementDashboard {
  generated_at: string;
  view: ProcurementDashboardView;
  groups: ProcurementSourceGroup[];
  total_cases: number;
  counts: ProcurementDashboardCounts;
}

export interface ProcurementRefreshResult {
  status: string;
  summary: Record<string, unknown>;
}

export type ProcurementRoleAgentStatus =
  | "waiting_human"
  | "waiting_external"
  | "completed"
  | "failed";

export interface ProcurementRoleAgentResume {
  role_status: ProcurementRoleAgentStatus;
  summary?: string | null;
  wait_reason?: string | null;
  output_data?: Record<string, unknown>;
}

export interface ProcurementRoleAgentResult extends ProcurementRoleAgentResume {
  agent_id?: string | null;
  case_id: string;
  correlation_id: string;
}

export interface ProductionPreparationEngineerCaseInput {
  case_id: string;
  case_number: string;
  source_1c_ref: string;
  source_number?: string | null;
  source_date?: string | null;
  source_status?: string | null;
  source_data_version?: string | null;
  source_synced_at?: string | null;
  initiator_name?: string | null;
  department_name?: string | null;
  warehouse_name?: string | null;
  required_date?: string | null;
  production_order_1c_ref?: string | null;
  production_order_number?: string | null;
  production_order_status?: string | null;
}

export interface ProductionPreparationSpecificationMaterial {
  line_id: string;
  nomenclature_id: string;
  nomenclature_name: string;
  characteristic_name?: string | null;
  unit?: string | null;
  consumption_rate: string | number;
  technological_loss_percent: string | number;
  production_stage_name?: string | null;
}

export interface ProductionPreparationSpecification {
  specification_id: string;
  name: string;
  version?: string | null;
  status: string;
  valid_from?: string | null;
  valid_to?: string | null;
  product_id: string;
  completeness_score: number;
  materials: ProductionPreparationSpecificationMaterial[];
}

export interface ProductionPreparationSupplyBreakdown {
  source_type: string;
  quantity: string | number;
  supply_ids: string[];
}

export interface ProductionPreparationExclusion {
  supply_id: string;
  source_type: string;
  quantity: string | number;
  reason: string;
  evidence_id?: string | null;
}

export interface ProductionPreparationCriticalImpact {
  production_order?: string | null;
  production_stage?: string | null;
  shortage_start_date?: string | null;
  possible_stop_date?: string | null;
  unprovided_product_quantity?: string | number | null;
  consequence: string;
  recommended_priority: string;
}

export interface ProductionPreparationPositionCalculation {
  line_id: string;
  nomenclature_id: string;
  nomenclature_name: string;
  characteristic_name?: string | null;
  unit: string;
  production_order?: string | null;
  production_stage?: string | null;
  product_quantity: string | number;
  consumption_rate: string | number;
  technological_loss_percent: string | number;
  gross_requirement: string | number;
  free_stock: string | number;
  available_other_warehouses: string | number;
  warehouse_stock_before?: string | number;
  warehouse_stock_used?: string | number;
  warehouse_stock_remaining?: string | number;
  confirmed_arrivals: string | number;
  total_available_supply: string | number;
  net_requirement: string | number;
  required_date: string;
  criticality: "normal" | "high" | "critical";
  outcome: string;
  coverage_method: string;
  recommendation: string;
  specification_id: string;
  specification_version?: string | null;
  supply_breakdown: ProductionPreparationSupplyBreakdown[];
  excluded_supply: ProductionPreparationExclusion[];
  linked_documents: Array<Record<string, string>>;
  critical_impact?: ProductionPreparationCriticalImpact | null;
}

export interface ProductionPreparationValidationIssue {
  code: string;
  message: string;
  field?: string | null;
  line_id?: string | null;
  source: string;
}

export interface ProductionPreparationEngineerOutput {
  schema_version: string;
  case: ProductionPreparationEngineerCaseInput;
  calculated_at: string;
  evidence_fingerprint: string;
  specifications: ProductionPreparationSpecification[];
  positions: ProductionPreparationPositionCalculation[];
  validation_issues: ProductionPreparationValidationIssue[];
  missing_data: string[];
  excluded_capabilities: string[];
  evidence_ids: string[];
  summary: string;
  recommended_next_step: string;
}

export interface ProductionPreparationEngineerResult
  extends Omit<ProcurementRoleAgentResult, "output_data"> {
  output_data: ProductionPreparationEngineerOutput;
}

export interface ProductionPreparationEngineerCaseDetail
  extends Omit<ProcurementCaseDetail, "latest_result"> {
  latest_result?: ProductionPreparationEngineerResult | null;
}

export type ProductionPreparationEngineerDashboard = ProcurementDashboard;

export interface ProductionDispatcherRecommendation {
  method: "reserve_stock" | "transfer" | "link_incoming" | "procurement" | "none";
  quantity: string | number;
  label: string;
  details?: string | null;
  requires_confirmation?: boolean;
}

export interface ProductionDispatcherPosition {
  line_id: string;
  nomenclature_id: string;
  nomenclature_name: string;
  characteristic_name?: string | null;
  unit: string;
  minimum_stock: string | number;
  maximum_stock: string | number;
  reorder_point: string | number;
  stock_growth_coefficient: string | number;
  free_stock: string | number;
  store_room_stock: string | number;
  expected_in_transit: string | number;
  expected_in_progress: string | number;
  expected_total: string | number;
  confirmed_arrivals: string | number;
  available_other_warehouses: string | number;
  production_demand: string | number;
  stock_position: string | number;
  forecast_stock: string | number;
  below_minimum: boolean;
  below_reorder_point: boolean;
  net_deficit: string | number;
  recommended_order_quantity: string | number;
  required_date?: string | null;
  urgency: "normal" | "high" | "critical";
  wait_allowed: boolean;
  outcome: string;
  coverage_method: string;
  recommendation: string;
  recommendations: ProductionDispatcherRecommendation[];
  formulas?: Record<string, string>;
}

export interface ProductionDispatcherOutput {
  schema_version?: string;
  calculated_at?: string;
  evidence_fingerprint?: string;
  positions: ProductionDispatcherPosition[];
  validation_issues?: Array<{ code: string; message: string }>;
  missing_data?: string[];
  excluded_capabilities?: string[];
  summary: string;
  recommended_next_step: string;
  decision_kind: "supply_confirmation" | "critical_acknowledgement" | "none";
}

export type OmtoQualityStatus = "ok" | "incomplete" | "critical";
export type OmtoFindingSeverity = "info" | "warning" | "critical";

export interface OmtoFinding {
  field: string;
  rule_id: string;
  source_ref: string;
  message: string;
  severity: OmtoFindingSeverity;
  suggested_fix?: string | null;
  current_value?: unknown;
}

export interface OmtoSupportManagerOutput {
  quality_status: OmtoQualityStatus;
  findings: OmtoFinding[];
  checked_fields: string[];
  actions: string[];
  clarification_draft?: string | null;
  summary: string;
  calculated_at?: string | null;
}

export interface OmtoSupportManagerResult
  extends Omit<ProcurementRoleAgentResult, "output_data"> {
  output_data: OmtoSupportManagerOutput;
}

export interface OmtoSupportManagerCaseDetail
  extends Omit<ProcurementCaseDetail, "latest_result" | "case_metadata"> {
  latest_result?: OmtoSupportManagerResult | null;
  case_metadata?: {
    omto_support_manager_output?: OmtoSupportManagerOutput | null;
    omto_calculated_at?: string | null;
  } | null;
}

export type OmtoSupportManagerDashboard = ProcurementDashboard;

export interface QualitySampleRule {
  rule_id: string;
  category: string;
  sample_size?: number | null;
  sample_note: string;
  scrap_threshold_pct?: number;
  lot_qty?: number | null;
  presentation_ref?: string | null;
  nomenclature_ref?: string | null;
  supplier_ref?: string | null;
  supplier_quality_rating?: string | number | null;
  sample_pct?: number | null;
  sample_basis?: string | null;
  require_second_sample?: boolean;
  second_sample_size?: number | null;
}

export interface QualityFinding {
  field: string;
  rule_id: string;
  source_ref: string;
  message: string;
  severity: OmtoFindingSeverity;
  suggested_fix?: string | null;
  current_value?: unknown;
}

export interface QualityRoleOutput {
  actions?: string[];
  findings?: QualityFinding[];
  next_status?: string | null;
  next_agent?: string | null;
  summary: string;
  calculated_at?: string | null;
  sample_rule?: QualitySampleRule | null;
  quality_control?: (Record<string, unknown> & {
    sample_rule?: QualitySampleRule | null;
    sample_size?: number | null;
    presentation_ref?: string | null;
    nomenclature_ref?: string | null;
    supplier_ref?: string | null;
    supplier_quality_rating?: string | number | null;
  }) | null;
  draft_artifacts?: (Record<string, unknown> & {
    control_program?: QualitySampleRule | null;
    scrap_decision?: Record<string, unknown> | null;
    lot_qty?: number | null;
    presentation_ref?: string | null;
  }) | null;
  assigned_engineer_id?: string | null;
  assigned_engineer_name?: string | null;
  act_ref?: string | null;
  label_ref?: string | null;
  disposition?: string | null;
  disposition_label?: string | null;
  execution_conditions?: string[];
  fitness_status?: string | null;
  category?: string | null;
  stage?: string | null;
  [key: string]: unknown;
}

export interface QualityRoleCaseDetail
  extends Omit<ProcurementCaseDetail, "latest_result" | "case_metadata"> {
  latest_result?: (Omit<ProcurementRoleAgentResult, "output_data"> & {
    output_data: QualityRoleOutput;
  }) | null;
  case_metadata?: Record<string, unknown> | null;
}

export type QualityRoleDashboard = ProcurementDashboard;

export interface KpiMetric {
  id: string;
  title: string;
  formula: string;
  value?: number | null;
  target?: number | null;
  target_label: string;
  unit?: string;
  tone: "ok" | "warn" | "bad" | "unknown";
  sample_size?: number;
  details?: Record<string, unknown>;
}

export interface AgentKpiBlock {
  agent_id: string;
  agent_label: string;
  common: KpiMetric[];
  special: KpiMetric[];
  below_target: string[];
}

export interface QualityKpiReport {
  period_from?: string | null;
  period_to?: string | null;
  agents: AgentKpiBlock[];
  system: KpiMetric[];
  summary: string;
  calculated_at?: string | null;
  actions?: string[];
}
