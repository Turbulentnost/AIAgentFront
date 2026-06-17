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
export type NdChangeRequestStatus =
  | "draft"
  | "submitted"
  | "detecting_document"
  | "requires_manual_document_selection"
  | "document_selected"
  | "locating_change_place"
  | "requires_manual_location_selection"
  | "applying_changes"
  | "ready_for_user_review"
  | "sent_to_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";
export type NdChangeLocationStatus = "found" | "candidate" | "ambiguous" | "not_found" | "confirmed";
export type NdChangeOperationType =
  | "replace_section"
  | "replace_paragraph"
  | "insert_after"
  | "insert_before"
  | "delete_section"
  | "update_table"
  | "add_table_row"
  | "replace_appendix"
  | "update_reference"
  | "annul_document"
  | "replace_document"
  | "manual_review";
export type NdChangeApprovalStatus = "draft" | "sent" | "approved" | "rejected" | "completed";

export interface Agent {
  id: string;
  name: string;
  slug: string;
  purpose: string | null;
  status: AgentStatus;
  icon_url?: string | null;
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

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
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

export interface OneCSession {
  token: string | null;
  fio: string;
  expires_at: string | null;
  resolved_user: string | null;
  resolved_user_source?: string | null;
  token_created_at?: string;
  reused?: boolean;
}

export interface OneCTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string | null;
  author: string | null;
  completed: boolean;
}

export interface OneCTasksResponse {
  token: string | null;
  count: number;
  cached: boolean;
  task_object?: string;
  query?: string;
  resolved_user: string;
  tasks: OneCTask[];
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
export interface OneCLoginResponse extends TokenResponse {
  user: User;
  is_created_via_1c: boolean;
  onec_session: OneCSession;
  token_reused?: boolean;
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
export interface ResponsibleUser {
  id: string;
  full_name: string | null;
  position: string | null;
  department_id: string | null;
  department_name: string | null;
}

export interface EmployeeSyncResult {
  key: string;
  source_system: string;
  resource: string;
  last_synced_at: string | null;
  next_allowed_at: string | null;
  status: string;
  items_count: number;
  error_message: string | null;
  created_count: number;
  updated_count: number;
  deactivated_count: number;
  skipped_count: number;
  missing_department_count: number;
  synced_count: number;
}

export interface Position {
  name: string;
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
  source_system?: string | null;
  external_id?: string | null;
  is_created_via_1c?: boolean;
  has_onec_credentials?: boolean;
  has_onec_session?: boolean;
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
}
export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  source_system: string | null;
  external_id: string | null;
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
export interface DepartmentSyncStatus {
  key: string;
  source_system: string;
  resource: string;
  last_synced_at: string | null;
  next_allowed_at: string | null;
  status: string;
  items_count: number;
  error_message: string | null;
  payload?: Record<string, unknown> | null;
  created_count?: number;
  updated_count?: number;
  deactivated_count?: number;
  synced_count?: number;
}
export type BrowserRunStatus = "pending" | "running" | "completed" | "failed" | "timeout" | "cancelled";
export type BrowserExtractMode = "text" | "html" | "screenshot" | "table";
export interface BrowserRunTable {
  headers: string[];
  rows: string[][];
}
export interface BrowserRun {
  id: string;
  requested_by_agent_id: string | null;
  requested_by_user_id: string;
  task_id: string | null;
  url: string;
  method: string;
  extract_mode: BrowserExtractMode | string;
  status: BrowserRunStatus;
  timeout_seconds: number;
  title: string | null;
  result_text: string | null;
  result_html: string | null;
  result_tables: BrowserRunTable[] | null;
  screenshot_object_name: string | null;
  error_message: string | null;
  finished_at: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
export interface BrowserRunResult {
  status?: BrowserRunStatus;
  title?: string | null;
  text?: string | null;
  html?: string | null;
  tables?: BrowserRunTable[];
  screenshot_data_url?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
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
  uploaded_by_user_id?: string | null;
  source_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  can_access?: boolean;
}

export interface DocumentListItem extends Document {
  can_access: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
export interface DocumentUploadOptions {
  title?: string;
  document_type?: DocumentType;
  department_id?: string;
  task_id?: string;
  is_knowledge_base?: boolean;
  relative_path?: string;
  onUploadProgress?: (progress: number) => void;
}

export interface DocumentChunk {
  id: string;
  document_id: string | null;
  document_version_id: string;
  chunk_index: number;
  text: string | null;
  content?: string | null;
  page_number: number | null;
  section_title: string | null;
  token_count: number | null;
  qdrant_collection: string | null;
  qdrant_point_id: string | null;
  embedding_model: string | null;
  is_indexed: boolean;
  metadata?: Record<string, unknown> | null;
  chunk_metadata?: Record<string, unknown> | null;
  vector_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NdChangeRequestCreate {
  reason: string;
  release_date?: string | null;
  effective_date?: string | null;
  change_text: string;
  department_id?: string | null;
  assumed_document_id?: string | null;
  assumed_document_code?: string | null;
  attachments?: string[];
  distribution_list?: string[];
  initiator_comment?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NdChangeRequest {
  id: string;
  number: string;
  reason: string;
  release_date: string | null;
  effective_date: string | null;
  change_text: string;
  initiator_user_id: string | null;
  department_id: string | null;
  status: NdChangeRequestStatus;
  selected_document_id: string | null;
  selected_document_version_id: string | null;
  detection_confidence: number | null;
  requires_manual_document_selection: boolean;
  requires_manual_location_selection: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface NdChangeCandidateDocument {
  id: string;
  change_request_id: string;
  document_id: string;
  document_version_id: string | null;
  score: number;
  rank: number;
  match_reason: string | null;
  matched_fragments: Array<Record<string, unknown>> | null;
  is_selected: boolean;
  document_title?: string | null;
  document_code?: string | null;
}

export interface NdChangeTargetLocation {
  id: string;
  change_request_id: string;
  document_id: string;
  document_version_id: string | null;
  section_number: string | null;
  section_title: string | null;
  page_number: number | null;
  chunk_id: string | null;
  location_type: string;
  current_text: string | null;
  confidence: number | null;
  status: NdChangeLocationStatus;
}

export interface NdChangeOperation {
  id: string;
  change_request_id: string;
  target_location_id: string | null;
  operation_type: NdChangeOperationType;
  old_text: string | null;
  new_text: string | null;
  diff: Array<{ section_number?: string | null; old_text?: string; new_text?: string }> | null;
  status: string;
  requires_manual_review: boolean;
}

export interface NdChangeDraftFile {
  id: string;
  change_request_id: string;
  document_id: string | null;
  source_document_version_id: string | null;
  draft_bucket: string;
  draft_object_name: string;
  original_filename: string | null;
  generated_filename: string;
  file_type: string;
  status: string;
  file_size: number | null;
  created_at: string;
}

export interface NdChangeApprovalParticipant {
  id: string;
  approval_route_id: string;
  user_id: string | null;
  role_name: string | null;
  approval_order: number;
  status: NdChangeApprovalStatus;
  comment: string | null;
  approved_at: string | null;
}

export interface NdChangeApprovalRoute {
  id: string;
  change_request_id: string;
  status: NdChangeApprovalStatus;
  created_by_user_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  participants: NdChangeApprovalParticipant[];
}

export interface NdChangeResult {
  id: string;
  change_request_id: string;
  agent_id: string | null;
  status: string;
  summary: string | null;
  confidence: number | null;
  selected_document_id: string | null;
  draft_file_id: string | null;
  change_notice_file_id: string | null;
  warnings: string[] | null;
  actions: Array<Record<string, unknown>> | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface NdChangePreview {
  request: NdChangeRequest;
  candidates: NdChangeCandidateDocument[];
  target_locations: NdChangeTargetLocation[];
  operations: NdChangeOperation[];
  draft_files: NdChangeDraftFile[];
  approval_routes: NdChangeApprovalRoute[];
  result: NdChangeResult | null;
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
export type KnowledgeBaseSourceStatus =
  | KnowledgeBaseStatus
  | "excluded"
  | "needs_ocr"
  | "ready_to_index";
export type KnowledgeBaseChunkQualityStatus = "unknown" | "good" | "medium" | "low" | "failed";
export type KnowledgeBaseSourcePrecheckStatus = "pending" | "passed" | "failed";
export type KnowledgeBaseAccessType =
  | "read"
  | "search"
  | "use_via_agent"
  | "manage_sources"
  | "reindex"
  | "manage_access"
  | "admin";
export type KnowledgeBaseGrantType = "user" | "department" | "role" | "organization" | "agent" | "admin_only";
export type KnowledgeBaseAgentAccessMode = "search_only" | "search_and_cite" | "decision" | "auto_action";
export type KnowledgeBaseIndexJobType = "full" | "source" | "chunk" | "embeddings" | "access_reindex";
export type KnowledgeBaseIndexJobStatus = "queued" | "running" | "completed" | "failed" | "partial" | "cancelled" | "CANCELLED";

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
  deleted_at?: string | null;
  deleted_by_user_id?: string | null;
  is_public: boolean;
  sources_count: number;
  fragments_count: number;
  storage_bytes: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface KnowledgeBaseListItem extends KnowledgeBase {
  can_access: boolean;
  can_search: boolean;
  can_delete: boolean;
  can_confirm_review: boolean;
  can_manage_access: boolean;
  indexing_active: boolean;
}

export interface KnowledgeBaseStats {
  total_bases: number;
  indexing_errors_count: number;
  storage_bytes: number;
  successfully_indexed_bases: number;
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

export interface KnowledgeBaseAccessExceptionInput extends KnowledgeBaseAccessGrantInput {
  is_deny: boolean;
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
  precheck_status?: KnowledgeBaseSourcePrecheckStatus;
  precheck_notes?: string | null;
  checksum?: string | null;
  quality_status?: KnowledgeBaseChunkQualityStatus;
  pages_count?: number | null;
  document_title?: string | null;
  original_filename?: string | null;
  extension?: string | null;
  relative_path?: string | null;
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
  quality_status?: KnowledgeBaseChunkQualityStatus;
  clause_number: string | null;
  fragment_type: string | null;
  access_snapshot: Record<string, unknown> | null;
  text?: string | null;
  metadata?: Record<string, unknown> | null;
  chunk_index?: number | null;
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
  total_sources_count?: number;
  total_chunks_count?: number;
  extracted_sources_count?: number;
  chunked_sources_count?: number;
  embedded_chunks_count?: number;
  qdrant_points_count?: number;
  fulltext_chunks_count?: number;
  processing_params?: Record<string, unknown> | null;
  cancel_requested?: boolean;
  cancel_requested_by_user_id?: string | null;
  cancel_requested_at?: string | null;
  cancel_reason?: string | null;
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

export interface KnowledgeBaseOverviewStats {
  sources_total: number;
  sources_processed: number;
  sources_with_errors: number;
  fragments_total: number;
  qdrant_points: number;
  fulltext_chunks: number;
  quality_percent: number;
  unresolved_errors: number;
}

export interface KnowledgeBaseReadiness {
  sources_total: number;
  sources_ready: number;
  fragments_total: number;
  fts_chunks: number;
  quality_percent: number;
  unresolved_errors: number;
  can_promote_to_ready: boolean;
  recommendation: string;
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

export type KnowledgeBaseSearchQueryStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface KnowledgeBaseSearchQuery {
  id: string;
  knowledge_base_id: string;
  query: string;
  top_k: number;
  status: KnowledgeBaseSearchQueryStatus;
  answer: string | null;
  hits: KnowledgeBaseSearchHit[] | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export type AgentBuilderSessionStatus =
  | "draft"
  | "planning"
  | "executing"
  | "needs_clarification"
  | "generated"
  | "needs_user_review"
  | "approved"
  | "failed"
  | "archived";

export type AgentBuilderPlanStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type AgentBlueprintStatus =
  | "draft"
  | "planning"
  | "generated"
  | "needs_user_review"
  | "approved"
  | "in_development"
  | "implemented"
  | "archived";

export interface AgentBuilderPlanStep {
  id: string;
  step_order: number;
  title: string;
  description?: string | null;
  status: AgentBuilderPlanStepStatus;
  started_at?: string | null;
  finished_at?: string | null;
  result?: Record<string, unknown> | null;
  error_message?: string | null;
}

export interface AgentBuilderPlan {
  id: string;
  goal: string;
  status: string;
  steps: AgentBuilderPlanStep[];
}

export interface AgentBuilderAttempt {
  id: string;
  attempt_number: number;
  goal?: string | null;
  success: boolean;
  result_summary?: string | null;
  failure_reason?: string | null;
  created_at: string;
}

export type AgentType = "consultant" | "action";

export interface WorkflowGraphNode {
  id: string;
  label: string;
  type?: string;
  capability?: string | null;
  goal?: string | null;
  node_kind?: string | null;
  status?: string | null;
}

export interface AgentTypeProposal {
  proposed_agent_type?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
  confirmed: boolean;
}

export interface AgentBlueprint {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  agent_type?: string | null;
  status: AgentBlueprintStatus;
  version: number;
  input_schema?: Record<string, unknown> | null;
  output_schema?: Record<string, unknown> | null;
  tools?: string[] | null;
  knowledge_bases?: string[] | null;
  workflow_graph?: {
    nodes: WorkflowGraphNode[];
    edges: Array<{ source: string; target: string; label?: string }>;
  } | null;
  human_approval_rules?: Array<Record<string, unknown>> | null;
  prompts?: Record<string, string> | null;
  test_cases?: Array<Record<string, unknown>> | null;
  report_template?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface AgentBuilderSession {
  id: string;
  goal: string;
  current_stage?: string | null;
  status: AgentBuilderSessionStatus;
  collected_requirements?: Record<string, unknown> | null;
  validation_result?: { valid: boolean; errors: string[]; warnings: string[] } | null;
  proposed_agent_structure?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AgentBuilderDesignStage {
  id: string;
  label: string;
  status: "pending" | "running" | "completed";
}

export interface AgentBuilderRequiredElement {
  key: string;
  label: string;
  question?: string | null;
  required?: boolean;
  value?: string | null;
  status?: "pending" | "filled";
}

export interface AgentBuilderRequirementsValidation {
  valid: boolean;
  errors?: string[];
  missing?: string[];
  elements?: AgentBuilderRequiredElement[];
}

export interface AgentBuilderDesignSummary {
  success: boolean;
  summary_type?: string | null;
  output_text?: string | null;
  capabilities: string[];
  runtime_dependencies: string[];
  input_params: string[];
  output_format: string[];
  valid: boolean;
  errors: string[];
}

export interface AgentBuilderSessionDetail extends AgentBuilderSession {
  plan?: AgentBuilderPlan | null;
  attempts: AgentBuilderAttempt[];
  blueprint?: AgentBlueprint | null;
  assistant_messages: string[];
  clarifying_questions: string[];
  design_stages: AgentBuilderDesignStage[];
  required_elements: AgentBuilderRequiredElement[];
  requirements_validation?: AgentBuilderRequirementsValidation | null;
  design_summary?: AgentBuilderDesignSummary | null;
  agent_type?: string | null;
  agent_type_proposal?: AgentTypeProposal | null;
}

export interface AgentBuilderToolCatalogItem {
  name: string;
  description: string;
  implemented: boolean;
  required_permissions: string[];
}

export interface SandboxStep {
  id: string;
  order_index: number;
  title?: string | null;
  capability?: string | null;
  tool_name?: string | null;
  status: string;
  request?: Record<string, unknown> | null;
  result_summary?: Record<string, unknown> | null;
  duration_ms?: number | null;
  error_message?: string | null;
}

export interface SandboxRunStats {
  total_steps?: number;
  success_steps?: number;
  error_steps?: number;
  avg_duration_ms?: number;
  total_duration_ms?: number;
}

export interface SandboxRun {
  id: string;
  session_id: string;
  status: string;
  test_query?: string | null;
  final_answer?: string | null;
  stats?: SandboxRunStats | null;
  executed_graph?: {
    nodes: WorkflowGraphNode[];
    edges: Array<{ source: string; target: string; label?: string }>;
  } | null;
  error_message?: string | null;
  steps: SandboxStep[];
}

export type NdDocumentType = "policy" | "regulation" | "procedure" | "sto" | "instruction";
export type NdQmsLevel = "strategic" | "organizational" | "process" | "technical" | "operational";
export type NdDocumentCardStatus = "active" | "draft" | "superseded" | "archived";
export type NdConfidentialityLevel = "public" | "restricted" | "confidential";

export interface NdControlPermissions {
  can_manage_departments: boolean;
  can_access_agent: boolean;
}

export interface NdControlDepartment {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_by_user_id: string | null;
  knowledge_bases_count: number;
  cards_count: number;
  documents_count?: number;
  processes_count?: number;
  pending_review_count?: number;
  knowledge_base_ids: string[];
  analysis_status?: string | null;
  analysis_progress_percent?: number | null;
}

export type DepartmentAnalysisRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

export interface DepartmentAnalysisRun {
  id: string;
  department_id: string;
  status: DepartmentAnalysisRunStatus;
  current_step: string;
  progress_percent: number;
  total_knowledge_bases: number;
  total_documents: number;
  processed_documents: number;
  skipped_documents: number;
  failed_documents: number;
  needs_review_documents: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  summary_json: Record<string, unknown> | null;
}

export interface NdControlDepartmentCreateResponse {
  department: NdControlDepartment;
  analysis_run: DepartmentAnalysisRun | null;
}

export interface DepartmentAnalysisStatus {
  department_id: string;
  run_id: string | null;
  status: DepartmentAnalysisRunStatus | null;
  current_step: string | null;
  progress_percent: number;
  total_documents: number;
  processed_documents: number;
  skipped_documents: number;
  failed_documents: number;
  needs_review_documents: number;
  message: string | null;
  summary: Record<string, unknown>;
}

export interface DepartmentSummary {
  department_id: string;
  department_name: string;
  analysis_status: string | null;
  knowledge_bases: Array<{
    id: string;
    name: string;
    description?: string | null;
    documents_count?: number;
    processed_count?: number;
    failed_count?: number;
    status?: string;
  }>;
  knowledge_bases_count?: number;
  documents_count: number;
  document_cards_count: number;
  processes_count: number;
  relations_count: number;
  pending_review_count: number;
  last_analysis_at?: string | null;
  last_analysis_run: DepartmentAnalysisRun | null;
}

export interface DepartmentStructuralDocumentCard {
  document_card_id: string;
  document_id: string;
  knowledge_base_id: string;
  file_name: string | null;
  document_code: string | null;
  title: string | null;
  document_type: string | null;
  version: string | null;
  status: string | null;
  extraction_status: string;
  extraction_confidence: string | null;
  processes_count: number;
  relations_count: number;
  needs_review_count: number;
  updated_at: string | null;
  purpose?: string | null;
}

export interface ProcessSourceDocumentItem {
  document_id: string;
  document_code: string | null;
  title: string | null;
  display_name: string;
  document_type: string | null;
  extraction_status: string | null;
  extraction_status_label: string | null;
}

export interface ProcessOwnerDisplay {
  candidate: string | null;
  confirmed: boolean;
  confidence: string | null;
  confidence_label: string | null;
  status_label: string;
  reason: string | null;
}

export interface ProcessActionDisplay {
  name: string;
  performer: string | null;
  controller: string | null;
  system_or_resource: string | null;
  evidence_label: string | null;
}

export interface ProcessRelationsSummary {
  total: number;
  confirmed: number;
  unconfirmed: number;
  without_evidence: number;
}

export interface DepartmentProcessItem {
  process_id: string;
  name: string;
  canonical_name: string;
  description: string | null;
  goal: string | null;
  owner: ProcessOwnerDisplay;
  owner_candidate: string | null;
  owner_confirmed: boolean;
  owner_confidence: string | null;
  owner_confidence_label: string | null;
  owner_status_label: string | null;
  source_documents: ProcessSourceDocumentItem[];
  source_document_names: string[];
  source_documents_count: number;
  inputs: string[];
  outputs: string[];
  actions: ProcessActionDisplay[];
  action_names: string[];
  forms: string[];
  systems: string[];
  resources: string[];
  systems_preview: string;
  relations_count: number;
  relations_summary: ProcessRelationsSummary;
  forms_count: number;
  systems_count: number;
  needs_review: boolean;
  pending_relations_count: number;
}

export interface RelationEntityDisplay {
  type: string;
  type_label: string;
  id: string | null;
  name: string;
}

export interface RelationEvidenceDisplay {
  label: string;
  document_code?: string | null;
  section?: string | null;
  quote?: string | null;
}

export interface DepartmentRelationItem {
  relation_id: string;
  source_type: string;
  source_type_label: string;
  source_id: string | null;
  source_display_name: string;
  source: RelationEntityDisplay;
  relation_type: string;
  relation_type_label: string;
  relation: { type: string; label: string };
  target_type: string;
  target_type_label: string;
  target_id: string | null;
  target_display_name: string;
  target: RelationEntityDisplay;
  confidence: string;
  confidence_label: string;
  extraction_type: string;
  extraction_type_label: string;
  confirmation_status: string;
  confirmation_status_label: string;
  is_confirmed: boolean;
  review_status: string;
  review_status_label: string;
  evidence_summary: string | null;
  evidence_json: Array<Record<string, unknown>>;
  evidence: RelationEvidenceDisplay;
  relation_description: string;
  is_weak_relation: boolean;
  is_service_relation: boolean;
  is_primary_relation: boolean;
  has_evidence: boolean;
  requires_review: boolean;
  can_bulk_approve: boolean;
  created_at?: string | null;
}

export interface DepartmentReviewPending {
  process_owners: Array<{
    process_id: string;
    process_name: string;
    owner_candidate: string | null;
    confidence: string | null;
    confidence_label: string | null;
    evidence: Record<string, unknown> | null;
  }>;
  relations: DepartmentRelationItem[];
  important_relations: DepartmentRelationItem[];
  relations_without_evidence: DepartmentRelationItem[];
  weak_relations: DepartmentRelationItem[];
  extraction_errors: Array<{
    document_card_id: string;
    document_id: string;
    document_code: string | null;
    title: string | null;
    reason: string | null;
    extraction_status: string;
  }>;
  documents: Array<{
    document_card_id: string;
    document_id: string;
    document_code: string | null;
    title: string | null;
    reason: string | null;
    extraction_status: string;
  }>;
  conflicts: Array<Record<string, unknown>>;
}

export interface DepartmentAnalysisRunListItem {
  run_id: string;
  started_at: string | null;
  finished_at: string | null;
  status: DepartmentAnalysisRunStatus;
  total_documents: number;
  processed_documents: number;
  skipped_documents: number;
  failed_documents: number;
  needs_review_documents: number;
  processes_created: number;
  relations_created: number;
  duration_seconds: number | null;
  error_message: string | null;
}

export interface NdControlDepartmentCreate {
  name: string;
  description?: string | null;
  knowledge_base_ids: string[];
  auto_start_analysis?: boolean;
}

export interface NdDocumentCard {
  id: string;
  department_id: string;
  knowledge_base_id: string;
  knowledge_base_source_id: string;
  document_id: string;
  document_version_id: string;
  document_code: string | null;
  document_name: string | null;
  document_type: NdDocumentType | null;
  qms_level: NdQmsLevel | null;
  version: string | null;
  status: NdDocumentCardStatus;
  approval_date: string | null;
  effective_date: string | null;
  process_owner: string | null;
  author: string | null;
  reviewer: string | null;
  approver: string | null;
  owner_department: string | null;
  scope: string | null;
  related_processes: string[] | null;
  related_departments: string[] | null;
  related_documents: string[] | null;
  normative_references: string[] | null;
  record_forms: string[] | null;
  retention_period: string | null;
  original_storage_location: string | null;
  electronic_storage_location: string | null;
  has_process_diagram: boolean;
  has_acknowledgement_sheet: boolean;
  acknowledgement_targets: string[] | null;
  confidentiality_level: NdConfidentialityLevel | null;
  change_history: Array<Record<string, unknown>> | null;
  approval_history: Array<Record<string, unknown>> | null;
  attachments: string[] | null;
  archived_versions: string[] | null;
}

export type NdDocumentCardUpdate = Partial<
  Omit<
    NdDocumentCard,
    "id" | "department_id" | "knowledge_base_id" | "knowledge_base_source_id" | "document_id" | "document_version_id"
  >
>;
