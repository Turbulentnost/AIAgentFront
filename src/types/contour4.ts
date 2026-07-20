export type Contour4AgentId =
  | "cfo_head"
  | "finance_director"
  | "executive_director"
  | "chief_accountant"
  | "accountant"
  | "legal_specialist";

export type KpiDirection = "gte" | "lte" | "eq";

export type KpiStatus = "ok" | "border" | "below";

export type Contour4WidgetType =
  | "kpi_cards"
  | "table"
  | "chart_bar"
  | "chart_line"
  | "chart_pie"
  | "timeline"
  | "note";

export interface Contour4Kpi {
  id: string;
  name: string;
  target: string;
  targetNum: number;
  direction: KpiDirection;
  value: number;
  unit: string;
  blocking: boolean;
}

export interface Contour4HitlField {
  key: string;
  label: string;
  value: string;
  format: "money" | "text" | "number" | "bool";
}

export interface Contour4HitlButton {
  id: string;
  label: string;
  action: string;
  style: "primary" | "secondary" | "danger";
  requires_comment: boolean;
}

export interface Contour4WidgetColumn {
  key: string;
  label: string;
}

export interface Contour4WidgetCard {
  key: string;
  label: string;
  value: string | number;
  format?: "money" | "text" | "number" | "bool";
}

export interface Contour4WidgetSeries {
  name: string;
  values: number[];
}

export interface Contour4TimelineItem {
  label: string;
  value: string;
  status?: "ok" | "warn" | "bad" | "pending";
}

export interface Contour4WidgetData {
  cards?: Contour4WidgetCard[];
  columns?: Contour4WidgetColumn[];
  rows?: Array<Record<string, string | number | boolean | null | undefined>>;
  labels?: string[];
  series?: Contour4WidgetSeries[];
  text?: string;
  items?: Contour4TimelineItem[];
}

export interface Contour4Widget {
  id: string;
  type: Contour4WidgetType;
  title: string;
  visible?: boolean;
  priority?: number;
  data: Contour4WidgetData;
}

export interface Contour4Hitl {
  title: string;
  summary: string;
  /** Keycloak / HITL assignee role code */
  assignee_role: Contour4AgentId | string;
  /** Alias for backend OrchestratorEnvelope.hitl_assignee_role */
  hitl_assignee_role?: string;
  fields: Contour4HitlField[];
  buttons: Contour4HitlButton[];
  suggested_action: string;
  risks: string[];
  norm_refs: string[];
  recommendation?: string;
}

export interface Contour4Notification {
  id: string;
  type: "hitl" | "escalation" | "info";
  title: string;
  text: string;
  time: string;
  unread: boolean;
}

export interface Contour4HitlDecisionPayload {
  agent_id: Contour4AgentId;
  human_action: string;
  human_payload: { comment?: string; line_priorities?: unknown[] };
  idempotency_key: string;
  hitl_assignee_role: string;
  user_role: string;
}

export interface Contour4AgentMock {
  id: Contour4AgentId;
  title: string;
  role: string;
  tz: string;
  sysNo: string;
  reportsTo: string;
  autonomy: string;
  port: number;
  /** ABAC: ЦФО code for cfo_head mock filtering */
  cfo_code?: string;
  specialKpis: Contour4Kpi[];
  hitl: Contour4Hitl;
  notifications: Contour4Notification[];
  widgets: Contour4Widget[];
  requires_human_review: boolean;
}

export interface Contour4KpiSummary {
  ok: number;
  border: number;
  below: number;
  blocking: number;
  total: number;
  pct: number;
  guardrail: number;
}

export interface Contour4SessionRole {
  /** Active Contour4 role claim (stub until Keycloak) */
  user_role: Contour4AgentId | string;
  cfo_code?: string;
}
