export type ProcurementSourceType =
  | "internal_consumption_order"
  | "production_material_order"
  | "transfer_order"
  | "reorder_point";

export interface ProcurementPermissions {
  can_access_orchestrator: boolean;
  can_refresh: boolean;
  is_superuser: boolean;
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

export interface ProcurementCaseSummary {
  id: string;
  correlation_id: string;
  source_type: ProcurementSourceType | string;
  source_1c_ref: string;
  source_number?: string | null;
  source_date?: string | null;
  source_status?: string | null;
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

export interface ProcurementDashboard {
  generated_at: string;
  groups: ProcurementSourceGroup[];
  total_cases: number;
}

export interface ProcurementRefreshResult {
  status: string;
  summary: Record<string, unknown>;
}
