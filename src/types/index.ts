export type AgentStatus = "draft" | "testing" | "ope" | "refinement" | "active" | "suspended" | "archived";
export type TaskStatus = "pending" | "planning" | "running" | "waiting_human" | "completed" | "completed_with_issues" | "failed" | "cancelled";
export type TaskStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type DocumentType =
  | "task_input"
  | "regulation"
  | "tz"
  | "pmi"
  | "kd"
  | "td"
  | "contract"
  | "specification"
  | "act"
  | "checklist"
  | "protocol"
  | "order"
  | "memo"
  | "other";
export type DocumentProcessingStatus =
  | "uploaded"
  | "text_extraction_pending"
  | "text_extracted"
  | "indexing_pending"
  | "indexed"
  | "failed";
export type TextExtractStatus = "not_started" | "processing" | "extracted" | "failed";

export interface Agent {
  id: string;
  name: string;
  slug: string;
  purpose: string | null;
  status: AgentStatus;
  department_id?: string | null;
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
}
export interface AgentAccess extends Agent {
  access_level: string | null;
  can_run: boolean;
  can_view_results: boolean;
  can_approve: boolean;
  can_configure: boolean;
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  agent_id: string | null;
  created_by_id: string | null;
  document_ids: string[];
  task_type: string | null;
  input_payload: Record<string, unknown> | null;
  run_parameters: Record<string, unknown> | null;
  celery_task_id: string | null;
  requires_human_review: boolean;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  task_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
export interface TaskCreate {
  title: string;
  description?: string;
  agent_id?: string | null;
  document_ids?: string[];
  task_type?: string;
  input_payload?: Record<string, unknown>;
  run_parameters?: Record<string, unknown>;
  requires_human_review?: boolean;
  task_metadata?: Record<string, unknown>;
}
export interface TaskStep {
  id: string;
  task_id: string;
  agent_id: string | null;
  step_key: string | null;
  title: string | null;
  description: string | null;
  step_status: TaskStepStatus;
  order_index: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  order: number;
  name: string;
  status: TaskStatus;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
export interface TaskResult {
  id: string;
  task_id: string;
  agent_id: string | null;
  status: string;
  conclusion: string | null;
  summary: string | null;
  findings: Record<string, unknown>[] | null;
  requires_human_review: boolean;
  report_url: string | null;
  is_current: boolean;
  generated_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
export interface HealthResponse {
  status: string;
  environment: string;
  version: string;
  checks?: Record<string, string> | null;
}
export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_at: string | null;
}
export interface LoginPayload {
  email: string;
  password: string;
  new_password?: string;
}
export interface User {
  id: string;
  email: string;
  username: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  full_name: string | null;
  phone: string | null;
  position: string | null;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  must_change_password: boolean;
  department_id: string | null;
  role_id: string | null;
  avatar_bucket: string | null;
  avatar_object_name: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface UserCreate {
  email: string;
  username?: string;
  password: string;
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  phone?: string;
  position?: string;
  department_id?: string | null;
  role_id?: string | null;
}
export interface UserAgentGrantCreate {
  agent_id: string;
  access_level?: string;
  can_run?: boolean;
  can_view_results?: boolean;
  can_approve?: boolean;
  can_configure?: boolean;
  expires_at?: string | null;
}
export interface AdminUserCreate extends UserCreate {
  is_active?: boolean;
  is_verified?: boolean;
  is_superuser?: boolean;
  must_change_password?: boolean;
  agent_access?: UserAgentGrantCreate[];
}
export interface UserUpdate {
  email?: string;
  username?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  position?: string | null;
  department_id?: string | null;
  role_id?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
}
export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface DepartmentCreate {
  name: string;
  slug: string;
  description?: string;
  parent_id?: string | null;
  is_active?: boolean;
}
export interface Document {
  id: string;
  title: string;
  original_filename: string | null;
  content_type: string | null;
  file_size: number | null;
  document_type: DocumentType;
  processing_status: DocumentProcessingStatus;
  is_knowledge_base: boolean;
  is_indexed: boolean;
  text_extract_status: TextExtractStatus;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface DocumentUploadOptions {
  title?: string;
  document_type?: DocumentType;
  department_id?: string;
  task_id?: string;
  is_knowledge_base?: boolean;
}
export interface ChunkSearchHit {
  content: string;
  score: number;
  document_id: string | null;
  metadata: Record<string, unknown> | null;
}
export interface ChunkSearchQuery {
  query: string;
  top_k?: number;
}
