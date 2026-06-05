export type AgentStatus = "draft" | "testing" | "ope" | "refinement" | "active" | "suspended" | "archived";
export type TaskStatus = "pending" | "planning" | "running" | "waiting_human" | "completed" | "completed_with_issues" | "failed" | "cancelled";
export type TaskStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type DocumentType =
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
  department_id: string | null;
  document_type: DocumentType;
  processing_status: DocumentProcessingStatus;
  is_knowledge_base: boolean;
  is_indexed: boolean;
  text_extract_status: TextExtractStatus;
  version: number;
  source_url?: string | null;
  metadata?: Record<string, unknown> | null;
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
  knowledge_base_id?: string;
  agent_id?: string;
}

export type KnowledgeBaseStatus = "draft" | "processing" | "needs_review" | "ready" | "updating" | "error" | "archived";
export type KnowledgeBaseSourceStatus = KnowledgeBaseStatus;
export type KnowledgeBaseAccessType =
  | "read"
  | "search"
  | "use_via_agent"
  | "manage_sources"
  | "reindex"
  | "manage_access"
  | "admin";
export type KnowledgeBaseGrantType = "user" | "department" | "agent" | "admin_only";
export type KnowledgeBaseAgentAccessMode = "search_only" | "search_and_cite" | "decision" | "auto_action";
export type KnowledgeBaseIndexJobType = "full" | "source" | "chunk" | "embeddings" | "access_reindex";
export type KnowledgeBaseIndexJobStatus = "queued" | "running" | "completed" | "failed" | "partial";

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  owner_user_id: string | null;
  responsible_user_id: string | null;
  topic: string | null;
  process_slug: string | null;
  status: KnowledgeBaseStatus;
  embedding_model: string | null;
  vector_store: string;
  qdrant_collection: string;
  last_indexed_at: string | null;
  is_public: boolean;
  sources_count: number;
  fragments_count: number;
  storage_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseStats {
  total_bases: number;
  active_bases: number;
  documents_in_bases: number;
  fragments_count: number;
  storage_bytes: number;
  successful_indexing_percent: number;
  errors_count: number;
  needs_review_count: number;
}

export interface KnowledgeBaseAccessGrantInput {
  grantee_type: KnowledgeBaseGrantType;
  grantee_id?: string | null;
  access_type: KnowledgeBaseAccessType;
  include_child_departments?: boolean;
  expires_at?: string | null;
  reason?: string | null;
  comment?: string | null;
  responsible_user_id?: string | null;
}

export interface KnowledgeBaseCreate {
  name: string;
  description?: string | null;
  department_id?: string | null;
  responsible_user_id?: string | null;
  topic?: string | null;
  process_slug?: string | null;
  embedding_model?: string | null;
  metadata?: Record<string, unknown> | null;
  access_grants: KnowledgeBaseAccessGrantInput[];
  source_document_ids?: string[];
}

export interface KnowledgeBaseSource {
  id: string;
  knowledge_base_id: string;
  document_id: string;
  document_version_id: string;
  added_by_user_id: string | null;
  added_at: string;
  processing_status: KnowledgeBaseSourceStatus;
  last_indexed_at: string | null;
  fragments_count: number;
  file_size: number | null;
  access_snapshot: Record<string, unknown> | null;
  document_title?: string | null;
  original_filename?: string | null;
  extension?: string | null;
  department_id?: string | null;
  linked_agents_count?: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseChunk {
  id: string;
  knowledge_base_id: string;
  source_id: string;
  document_chunk_id: string;
  is_excluded_from_search: boolean;
  exclusion_reason: string | null;
  indexed_at: string | null;
  embedding_status: string;
  clause_number: string | null;
  fragment_type: string | null;
  access_snapshot: Record<string, unknown> | null;
  text?: string | null;
  document_id?: string | null;
  document_title?: string | null;
  page_number?: number | null;
  section_title?: string | null;
}

export interface KnowledgeBaseRule {
  id: string;
  knowledge_base_id: string;
  text: string;
  scope: string | null;
  condition: string | null;
  agent_action: string | null;
  priority: number;
  status: string;
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseAgentBinding {
  id: string;
  knowledge_base_id: string;
  agent_id: string;
  access_mode: KnowledgeBaseAgentAccessMode;
  expires_at: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseAgentBindingInput {
  agent_id: string;
  access_mode: KnowledgeBaseAgentAccessMode;
  expires_at?: string | null;
  is_enabled?: boolean;
}

export interface KnowledgeBaseIndexingJob {
  id: string;
  knowledge_base_id: string;
  job_type: KnowledgeBaseIndexJobType;
  status: KnowledgeBaseIndexJobStatus;
  target_source_id: string | null;
  processed_sources_count: number;
  created_fragments_count: number;
  updated_fragments_count: number;
  errors_count: number;
  duration_ms: number | null;
  started_by_user_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  embedding_model: string | null;
  vector_store: string;
  qdrant_collection: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseIndexingError {
  id: string;
  job_id: string;
  knowledge_base_id: string;
  source_id: string | null;
  error_type: string;
  technical_message: string | null;
  user_message: string | null;
  recommended_action: string | null;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseSearchHit {
  content: string;
  score: number;
  accessible: boolean;
  access_reason: string;
  knowledge_base_id: string;
  knowledge_base_chunk_id: string | null;
  document_id: string | null;
  document_version_id: string | null;
  chunk_id: string | null;
  document_title: string | null;
  page_number: number | null;
  section_title: string | null;
  clause_number: string | null;
  metadata: Record<string, unknown> | null;
}

export interface KnowledgeBaseTestSearchResponse {
  hits: KnowledgeBaseSearchHit[];
  answer_preview: string | null;
}
