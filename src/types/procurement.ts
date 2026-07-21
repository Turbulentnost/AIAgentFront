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
}

export interface ProductionPreparationEngineerAction {
  status: string;
  action: "purchase_confirmed" | "critical_acknowledged";
  case_id: string;
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
