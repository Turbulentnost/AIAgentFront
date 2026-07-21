// Типы KPI-дашбордов ролевых агентов ОМТО (контур №3 «Закупка и выбор поставщика»).
// Соответствуют app/schemas/omto.py на бэкенде.

export interface OmtoPermissions {
  accessible_role_agents: string[];
  is_superuser: boolean;
}

export interface OmtoAgentPassport {
  slug: string;
  name: string;
  name_full: string;
  doc_ref: string;
  registry_no: number;
  position_role: string;
  purpose: string;
  contour: string;
  autonomy: string;
}

export type OmtoKpiStatus =
  | "achieved"
  | "warn"
  | "below"
  | "no_data"
  | "pending_integration";

export interface OmtoKpiRow {
  id: string;
  name: string;
  target: string;
  unit: "percent" | "count" | "number";
  blocking: boolean;
  guardrail: boolean;
  source: string;
  data_source: "runs" | "onec";
  value: number | null;
  status: OmtoKpiStatus;
  achieved: boolean | null;
}

export interface OmtoRuntimeStats {
  total_runs: number;
  completed: number;
  with_issues: number;
  needs_input: number;
  failed: number;
  waiting_human: number;
  hitl_required: number;
  avg_latency_ms: number;
  last_run_at: string | null;
}

export interface OmtoKpiSummary {
  total: number;
  achieved: number;
  warn: number;
  below: number;
  pending: number;
  blocking: number;
  guardrail: number;
  achievement_rate: number | null;
}

export interface OmtoDashboard {
  agent: OmtoAgentPassport;
  runtime: OmtoRuntimeStats;
  kpi: OmtoKpiRow[];
  summary: OmtoKpiSummary;
  generated_at: string;
}

export interface OmtoRunRequest {
  task_type: string;
  correlation_id?: string;
  tenant_id?: string;
  task_payload?: Record<string, unknown>;
}

export interface OmtoHitlPending {
  action: string | null;
  approver_role: string | null;
  payload: Record<string, unknown>;
  resume_node: string | null;
}

export interface OmtoRunResult {
  agent_id: string;
  status: string;
  role_status: string;
  summary: string | null;
  data_confidence: string;
  requires_human_review: boolean;
  correlation_id: string;
  thread_id: string;
  task_type: string;
  wait_reason: string | null;
  hitl_pending: OmtoHitlPending | null;
  output_data: Record<string, unknown>;
}

export interface OmtoResumeRequest {
  thread_id: string;
  resolution?: "approved" | "changes_requested" | "rejected";
  passed?: boolean;
  comment?: string;
}
