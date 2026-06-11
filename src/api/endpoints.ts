import { apiClient, longRunningApiClient } from "./client";
import type {
  Agent,
  AgentAccess,
  BrowserRun,
  BrowserRunResult,
  ChunkSearchHit,
  ChunkSearchQuery,
  Department,
  DepartmentCreate,
  DepartmentSyncStatus,
  EmployeeSyncResult,
  Document,
  DocumentUploadOptions,
  HealthResponse,
  KnowledgeBase,
  KnowledgeBaseAccessExceptionInput,
  KnowledgeBaseListItem,
  KnowledgeBaseAccessGrantInput,
  KnowledgeBaseAgentBinding,
  KnowledgeBaseAgentBindingInput,
  KnowledgeBaseChunk,
  KnowledgeBaseCreate,
  KnowledgeBaseIndexJobType,
  KnowledgeBaseIndexingError,
  KnowledgeBaseIndexingJob,
  KnowledgeBaseOverviewStats,
  KnowledgeBaseReadiness,
  KnowledgeBaseRule,
  KnowledgeBaseSource,
  KnowledgeBaseStats,
  KnowledgeBaseStatus,
  KnowledgeBaseSearchQuery,
  KnowledgeBaseTestSearchResponse,
  LoginPayload,
  OneCLoginResponse,
  OneCSession,
  NdChangeCandidateDocument,
  NdChangePreview,
  NdChangeRequest,
  NdChangeRequestCreate,
  NdChangeTargetLocation,
  Role,
  Task,
  TaskCreate,
  TaskResult,
  TaskStep,
  TokenResponse,
  ResponsibleUser,
  User,
  UserCreate,
  UserUpdate,
  AgentBlueprint,
  AgentBuilderSession,
  AgentBuilderSessionDetail,
  AgentBuilderPlan,
  AgentBuilderAttempt,
  AgentBuilderToolCatalogItem,
  SandboxRun
} from "@/types";

export const healthApi = {
  get: () => apiClient.get<HealthResponse>("/health").then((r) => r.data),
  ready: () => apiClient.get<HealthResponse>("/ready").then((r) => r.data)
};
export const authApi = {
  login: (payload: LoginPayload) => apiClient.post<TokenResponse>("/auth/login", payload).then((r) => r.data),
  loginWith1C: (payload: { fio: string; password: string }) =>
    longRunningApiClient.post<OneCLoginResponse>("/auth/onec/login", payload).then((r) => r.data),
  getOneCSession: () => apiClient.get<OneCSession>("/auth/onec/session").then((r) => r.data),
  me: () => apiClient.get<User>("/auth/me").then((r) => r.data),
  logout: () => apiClient.post("/auth/logout").then((r) => r.data),
  register: (payload: UserCreate) => apiClient.post<User>("/auth/register", payload).then((r) => r.data)
};
export const usersApi = {
  list: () => apiClient.get<User[]>("/users").then((r) => r.data),
  listResponsibleCandidates: () =>
    apiClient.get<ResponsibleUser[]>("/users/responsible-candidates").then((r) => r.data),
  syncFrom1C: () => apiClient.post<EmployeeSyncResult>("/users/sync").then((r) => r.data),
  get: (userId: string) => apiClient.get<User>(`/users/${userId}`).then((r) => r.data),
  create: (payload: UserCreate) => apiClient.post<User>("/users", payload).then((r) => r.data),
  update: (userId: string, payload: UserUpdate) =>
    apiClient.patch<User>(`/users/${userId}`, payload).then((r) => r.data),
  deactivate: (userId: string) => apiClient.post<User>(`/users/${userId}/deactivate`).then((r) => r.data),
  uploadAvatar: (userId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<User>(`/users/${userId}/avatar`, formData).then((r) => r.data);
  }
};
export const departmentsApi = {
  list: () => apiClient.get<Department[]>("/departments").then((r) => r.data),
  create: (payload: DepartmentCreate) => apiClient.post<Department>("/departments", payload).then((r) => r.data),
  syncStatus: () => apiClient.get<DepartmentSyncStatus>("/departments/sync/status").then((r) => r.data),
  syncFrom1C: () => apiClient.post<DepartmentSyncStatus>("/departments/sync").then((r) => r.data)
};
export const agentsApi = {
  list: () => apiClient.get<Agent[]>("/agents").then((r) => r.data),
  available: () => apiClient.get<AgentAccess[]>("/agents/available").then((r) => r.data)
};
export const rolesApi = {
  list: () => apiClient.get<Role[]>("/roles").then((r) => r.data)
};
export const tasksApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<Task[]>("/tasks", { params }).then((r) => r.data),
  get: (taskId: string) => apiClient.get<Task>(`/tasks/${taskId}`).then((r) => r.data),
  create: (payload: TaskCreate) => apiClient.post<Task>("/tasks", payload).then((r) => r.data),
  steps: (taskId: string) => apiClient.get<TaskStep[]>(`/tasks/${taskId}/steps`).then((r) => r.data),
  result: (taskId: string) => apiClient.get<TaskResult>(`/tasks/${taskId}/result`).then((r) => r.data)
};
export const browserRunsApi = {
  pending: () => apiClient.get<BrowserRun[]>("/browser-runs/pending").then((r) => r.data),
  submitResult: (runId: string, payload: BrowserRunResult) =>
    apiClient.post<BrowserRun>(`/browser-runs/${runId}/result`, payload).then((r) => r.data),
  get: (runId: string) => apiClient.get<BrowserRun>(`/browser-runs/${runId}`).then((r) => r.data)
};
export const documentsApi = {
  upload: (file: File, options: DocumentUploadOptions = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options.title) formData.append("title", options.title);
    if (options.document_type) formData.append("document_type", options.document_type);
    if (options.department_id) formData.append("department_id", options.department_id);
    if (options.task_id) formData.append("task_id", options.task_id);
    if (options.relative_path) formData.append("relative_path", options.relative_path);
    return apiClient.post<Document>("/documents/upload", formData).then((r) => r.data);
  },
  list: () => apiClient.get<Document[]>("/documents").then((r) => r.data),
  search: (query: string | ChunkSearchQuery) => {
    const body = typeof query === "string" ? { query, top_k: 5 } : query;
    return apiClient.post<ChunkSearchHit[]>("/documents/search", body).then((r) => r.data);
  },
  versions: (documentId: string) =>
    apiClient.get(`/documents/${documentId}/versions`).then((r) => r.data),
  chunks: (documentVersionId: string) =>
    apiClient.get(`/documents/versions/${documentVersionId}/chunks`).then((r) => r.data)
};

export const knowledgeBasesApi = {
  stats: () => apiClient.get<KnowledgeBaseStats>("/knowledge-bases/stats").then((r) => r.data),
  listResponsibleUsers: () =>
    apiClient.get<ResponsibleUser[]>("/knowledge-bases/responsible-users").then((r) => r.data),
  list: (params?: { status?: KnowledgeBaseStatus; query?: string }) =>
    apiClient.get<KnowledgeBaseListItem[]>("/knowledge-bases", { params }).then((r) => r.data),
  get: (knowledgeBaseId: string) => apiClient.get<KnowledgeBase>(`/knowledge-bases/${knowledgeBaseId}`).then((r) => r.data),
  create: (payload: KnowledgeBaseCreate) => apiClient.post<KnowledgeBase>("/knowledge-bases", payload).then((r) => r.data),
  delete: (knowledgeBaseId: string) =>
    apiClient.delete<KnowledgeBase>(`/knowledge-bases/${knowledgeBaseId}`).then((r) => r.data),
  overview: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseOverviewStats>(`/knowledge-bases/${knowledgeBaseId}/overview`).then((r) => r.data),
  readiness: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseReadiness>(`/knowledge-bases/${knowledgeBaseId}/readiness`).then((r) => r.data),
  sources: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseSource[]>(`/knowledge-bases/${knowledgeBaseId}/sources`).then((r) => r.data),
  addSource: (knowledgeBaseId: string, payload: { document_id: string; document_version_id?: string | null }) =>
    apiClient.post<KnowledgeBaseSource>(`/knowledge-bases/${knowledgeBaseId}/sources`, payload).then((r) => r.data),
  excludeSource: (knowledgeBaseId: string, sourceId: string) =>
    apiClient.post<KnowledgeBaseSource>(`/knowledge-bases/${knowledgeBaseId}/sources/${sourceId}/exclude`).then((r) => r.data),
  reindexSource: (knowledgeBaseId: string, sourceId: string) =>
    apiClient.post<KnowledgeBaseIndexingJob>(`/knowledge-bases/${knowledgeBaseId}/sources/${sourceId}/reindex`).then((r) => r.data),
  deleteSource: (knowledgeBaseId: string, sourceId: string) =>
    apiClient.delete(`/knowledge-bases/${knowledgeBaseId}/sources/${sourceId}`).then((r) => r.data),
  chunks: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseChunk[]>(`/knowledge-bases/${knowledgeBaseId}/chunks`).then((r) => r.data),
  excludeChunk: (knowledgeBaseId: string, chunkId: string, payload: { is_excluded_from_search: boolean; exclusion_reason?: string | null }) =>
    apiClient.patch<KnowledgeBaseChunk>(`/knowledge-bases/${knowledgeBaseId}/chunks/${chunkId}/exclude`, payload).then((r) => r.data),
  rules: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseRule[]>(`/knowledge-bases/${knowledgeBaseId}/rules`).then((r) => r.data),
  access: (knowledgeBaseId: string) =>
    apiClient.get<{ grants: KnowledgeBaseAccessGrantInput[]; exceptions: KnowledgeBaseAccessExceptionInput[] }>(`/knowledge-bases/${knowledgeBaseId}/access`).then((r) => r.data),
  updateAccess: (knowledgeBaseId: string, payload: { grants: KnowledgeBaseAccessGrantInput[]; exceptions?: KnowledgeBaseAccessExceptionInput[] }) =>
    apiClient.put(`/knowledge-bases/${knowledgeBaseId}/access`, payload).then((r) => r.data),
  agents: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseAgentBinding[]>(`/knowledge-bases/${knowledgeBaseId}/agents`).then((r) => r.data),
  updateAgents: (knowledgeBaseId: string, payload: KnowledgeBaseAgentBindingInput[]) =>
    apiClient.put<KnowledgeBaseAgentBinding[]>(`/knowledge-bases/${knowledgeBaseId}/agents`, payload).then((r) => r.data),
  index: (knowledgeBaseId: string, payload: { job_type: KnowledgeBaseIndexJobType; source_id?: string | null }) =>
    apiClient.post<KnowledgeBaseIndexingJob>(`/knowledge-bases/${knowledgeBaseId}/index`, payload).then((r) => r.data),
  cancelIndexing: (knowledgeBaseId: string, payload: { reason?: string | null; force?: boolean } = {}) =>
    apiClient.post<KnowledgeBaseIndexingJob>(`/knowledge-bases/${knowledgeBaseId}/index/cancel`, payload).then((r) => r.data),
  jobs: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseIndexingJob[]>(`/knowledge-bases/${knowledgeBaseId}/index/jobs`).then((r) => r.data),
  jobErrors: (jobId: string) =>
    apiClient.get<KnowledgeBaseIndexingError[]>(`/knowledge-bases/index/jobs/${jobId}/errors`).then((r) => r.data),
  retryIndexingError: (errorId: string) =>
    apiClient.post<KnowledgeBaseIndexingJob>(`/knowledge-bases/index/errors/${errorId}/retry`).then((r) => r.data),
  createRule: (knowledgeBaseId: string, payload: Partial<KnowledgeBaseRule>) =>
    apiClient.post<KnowledgeBaseRule>(`/knowledge-bases/${knowledgeBaseId}/rules`, payload).then((r) => r.data),
  testSearch: (knowledgeBaseId: string, payload: { query: string; top_k?: number; user_id?: string | null; department_id?: string | null; agent_id?: string | null }) =>
    apiClient.post<KnowledgeBaseTestSearchResponse>(`/knowledge-bases/${knowledgeBaseId}/test-search`, payload).then((r) => r.data),
  searchQueries: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseSearchQuery[]>(`/knowledge-bases/${knowledgeBaseId}/search-queries`).then((r) => r.data),
  createSearchQuery: (knowledgeBaseId: string, payload: { query: string; top_k?: number }) =>
    apiClient.post<KnowledgeBaseSearchQuery>(`/knowledge-bases/${knowledgeBaseId}/search-queries`, payload).then((r) => r.data),
  getSearchQuery: (knowledgeBaseId: string, searchQueryId: string) =>
    apiClient.get<KnowledgeBaseSearchQuery>(`/knowledge-bases/${knowledgeBaseId}/search-queries/${searchQueryId}`).then((r) => r.data),
  cancelSearchQuery: (knowledgeBaseId: string, searchQueryId: string) =>
    apiClient.post<KnowledgeBaseSearchQuery>(`/knowledge-bases/${knowledgeBaseId}/search-queries/${searchQueryId}/cancel`).then((r) => r.data),
  audit: (knowledgeBaseId: string) =>
    apiClient.get<Record<string, unknown>[]>(`/knowledge-bases/${knowledgeBaseId}/audit`).then((r) => r.data)
};

export const agentBuilderApi = {
  listSessions: () => apiClient.get<AgentBuilderSession[]>("/agent-builder/sessions").then((r) => r.data),
  createSession: (payload: { goal: string }) =>
    apiClient.post<AgentBuilderSession>("/agent-builder/sessions", payload).then((r) => r.data),
  getSession: (sessionId: string) =>
    apiClient.get<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}`).then((r) => r.data),
  deleteSession: (sessionId: string) =>
    apiClient.delete(`/agent-builder/sessions/${sessionId}`).then((r) => r.data),
  startSession: (sessionId: string) =>
    longRunningApiClient.post<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}/start`).then((r) => r.data),
  sendMessage: (sessionId: string, payload: { message: string }) =>
    longRunningApiClient
      .post<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}/message`, payload)
      .then((r) => r.data),
  getPlan: (sessionId: string) =>
    apiClient.get<AgentBuilderPlan | null>(`/agent-builder/sessions/${sessionId}/plan`).then((r) => r.data),
  getAttempts: (sessionId: string) =>
    apiClient.get<AgentBuilderAttempt[]>(`/agent-builder/sessions/${sessionId}/attempts`).then((r) => r.data),
  getBlueprint: (sessionId: string) =>
    apiClient.get<AgentBlueprint | null>(`/agent-builder/sessions/${sessionId}/blueprint`).then((r) => r.data),
  approveBlueprint: (sessionId: string) =>
    longRunningApiClient.post<AgentBlueprint>(`/agent-builder/sessions/${sessionId}/approve-blueprint`).then((r) => r.data),
  regenerate: (sessionId: string) =>
    longRunningApiClient.post<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}/regenerate`).then((r) => r.data),
  runPreview: (sessionId: string) =>
    longRunningApiClient.post<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}/preview`).then((r) => r.data),
  startSandboxRun: (sessionId: string, payload: { test_query?: string | null }) =>
    apiClient.post<SandboxRun>(`/agent-builder/sessions/${sessionId}/sandbox-run`, payload).then((r) => r.data),
  getLatestSandboxRun: (sessionId: string) =>
    apiClient.get<SandboxRun | null>(`/agent-builder/sessions/${sessionId}/sandbox-run`).then((r) => r.data),
  getSandboxRun: (sessionId: string, runId: string) =>
    apiClient.get<SandboxRun>(`/agent-builder/sessions/${sessionId}/sandbox-run/${runId}`).then((r) => r.data),
  listTools: () => apiClient.get<AgentBuilderToolCatalogItem[]>("/agent-builder/tools").then((r) => r.data)
};

export const ndChangeRequestsApi = {
  list: () => apiClient.get<NdChangeRequest[]>("/nd-change-requests").then((r) => r.data),
  create: (payload: NdChangeRequestCreate) => apiClient.post<NdChangeRequest>("/nd-change-requests", payload).then((r) => r.data),
  get: (requestId: string) => apiClient.get<NdChangePreview>(`/nd-change-requests/${requestId}`).then((r) => r.data),
  detectDocument: (requestId: string) =>
    apiClient.post<NdChangeCandidateDocument[]>(`/nd-change-requests/${requestId}/detect-document`).then((r) => r.data),
  selectDocument: (requestId: string, payload: { document_id: string; document_version_id?: string | null }) =>
    apiClient.post<NdChangeRequest>(`/nd-change-requests/${requestId}/select-document`, payload).then((r) => r.data),
  findLocation: (requestId: string, payload: { document_id?: string | null; document_version_id?: string | null } = {}) =>
    apiClient.post<NdChangeTargetLocation[]>(`/nd-change-requests/${requestId}/find-location`, payload).then((r) => r.data),
  applyChanges: (requestId: string, payload: { location_id?: string | null; mark_user_reviewed?: boolean; approval_user_ids?: string[] } = {}) =>
    apiClient.post<NdChangePreview>(`/nd-change-requests/${requestId}/apply-changes`, payload).then((r) => r.data),
  preview: (requestId: string) => apiClient.get<NdChangePreview>(`/nd-change-requests/${requestId}/preview`).then((r) => r.data),
  sendApproval: (requestId: string, payload: { approval_user_ids: string[]; mark_user_reviewed?: boolean }) =>
    apiClient.post(`/nd-change-requests/${requestId}/send-approval`, payload).then((r) => r.data),
  downloadDraft: (requestId: string) =>
    apiClient.get<Blob>(`/nd-change-requests/${requestId}/download-draft`, { responseType: "blob" }).then((r) => r.data),
  downloadNotice: (requestId: string) =>
    apiClient.get<Blob>(`/nd-change-requests/${requestId}/download-notice`, { responseType: "blob" }).then((r) => r.data)
};
