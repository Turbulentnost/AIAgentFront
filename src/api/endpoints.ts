import { apiClient } from "./client";
import type {
  Agent,
  AgentAccess,
  ChunkSearchHit,
  ChunkSearchQuery,
  Department,
  DepartmentCreate,
  Document,
  DocumentUploadOptions,
  HealthResponse,
  KnowledgeBase,
  KnowledgeBaseAccessGrantInput,
  KnowledgeBaseAgentBinding,
  KnowledgeBaseAgentBindingInput,
  KnowledgeBaseChunk,
  KnowledgeBaseCreate,
  KnowledgeBaseIndexJobType,
  KnowledgeBaseIndexingError,
  KnowledgeBaseIndexingJob,
  KnowledgeBaseRule,
  KnowledgeBaseSource,
  KnowledgeBaseStats,
  KnowledgeBaseStatus,
  KnowledgeBaseTestSearchResponse,
  LoginPayload,
  Task,
  TaskCreate,
  TaskResult,
  TaskStep,
  TokenResponse,
  User,
  UserCreate
} from "@/types";

export const healthApi = {
  get: () => apiClient.get<HealthResponse>("/health").then((r) => r.data),
  ready: () => apiClient.get<HealthResponse>("/ready").then((r) => r.data)
};
export const authApi = {
  login: (payload: LoginPayload) => apiClient.post<TokenResponse>("/auth/login", payload).then((r) => r.data),
  me: () => apiClient.get<User>("/auth/me").then((r) => r.data),
  logout: () => apiClient.post("/auth/logout").then((r) => r.data),
  register: (payload: UserCreate) => apiClient.post<User>("/auth/register", payload).then((r) => r.data)
};
export const usersApi = {
  list: () => apiClient.get<User[]>("/users").then((r) => r.data),
  get: (userId: string) => apiClient.get<User>(`/users/${userId}`).then((r) => r.data),
  create: (payload: UserCreate) => apiClient.post<User>("/users", payload).then((r) => r.data),
  deactivate: (userId: string) => apiClient.post<User>(`/users/${userId}/deactivate`).then((r) => r.data),
  uploadAvatar: (userId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<User>(`/users/${userId}/avatar`, formData).then((r) => r.data);
  }
};
export const departmentsApi = {
  list: () => apiClient.get<Department[]>("/departments").then((r) => r.data),
  create: (payload: DepartmentCreate) => apiClient.post<Department>("/departments", payload).then((r) => r.data)
};
export const agentsApi = {
  list: () => apiClient.get<Agent[]>("/agents").then((r) => r.data),
  available: () => apiClient.get<AgentAccess[]>("/agents/available").then((r) => r.data)
};
export const tasksApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<Task[]>("/tasks", { params }).then((r) => r.data),
  get: (taskId: string) => apiClient.get<Task>(`/tasks/${taskId}`).then((r) => r.data),
  create: (payload: TaskCreate) => apiClient.post<Task>("/tasks", payload).then((r) => r.data),
  steps: (taskId: string) => apiClient.get<TaskStep[]>(`/tasks/${taskId}/steps`).then((r) => r.data),
  result: (taskId: string) => apiClient.get<TaskResult>(`/tasks/${taskId}/result`).then((r) => r.data)
};
export const documentsApi = {
  upload: (file: File, options: DocumentUploadOptions = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options.title) formData.append("title", options.title);
    if (options.document_type) formData.append("document_type", options.document_type);
    if (options.department_id) formData.append("department_id", options.department_id);
    if (options.task_id) formData.append("task_id", options.task_id);
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
  list: (params?: { status?: KnowledgeBaseStatus; query?: string }) =>
    apiClient.get<KnowledgeBase[]>("/knowledge-bases", { params }).then((r) => r.data),
  get: (knowledgeBaseId: string) => apiClient.get<KnowledgeBase>(`/knowledge-bases/${knowledgeBaseId}`).then((r) => r.data),
  create: (payload: KnowledgeBaseCreate) => apiClient.post<KnowledgeBase>("/knowledge-bases", payload).then((r) => r.data),
  sources: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseSource[]>(`/knowledge-bases/${knowledgeBaseId}/sources`).then((r) => r.data),
  addSource: (knowledgeBaseId: string, payload: { document_id: string; document_version_id?: string | null }) =>
    apiClient.post<KnowledgeBaseSource>(`/knowledge-bases/${knowledgeBaseId}/sources`, payload).then((r) => r.data),
  chunks: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseChunk[]>(`/knowledge-bases/${knowledgeBaseId}/chunks`).then((r) => r.data),
  excludeChunk: (knowledgeBaseId: string, chunkId: string, payload: { is_excluded_from_search: boolean; exclusion_reason?: string | null }) =>
    apiClient.patch<KnowledgeBaseChunk>(`/knowledge-bases/${knowledgeBaseId}/chunks/${chunkId}/exclude`, payload).then((r) => r.data),
  rules: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseRule[]>(`/knowledge-bases/${knowledgeBaseId}/rules`).then((r) => r.data),
  access: (knowledgeBaseId: string) =>
    apiClient.get<{ grants: KnowledgeBaseAccessGrantInput[]; exceptions: KnowledgeBaseAccessGrantInput[] }>(`/knowledge-bases/${knowledgeBaseId}/access`).then((r) => r.data),
  updateAccess: (knowledgeBaseId: string, payload: { grants: KnowledgeBaseAccessGrantInput[]; exceptions?: KnowledgeBaseAccessGrantInput[] }) =>
    apiClient.put(`/knowledge-bases/${knowledgeBaseId}/access`, payload).then((r) => r.data),
  agents: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseAgentBinding[]>(`/knowledge-bases/${knowledgeBaseId}/agents`).then((r) => r.data),
  updateAgents: (knowledgeBaseId: string, payload: KnowledgeBaseAgentBindingInput[]) =>
    apiClient.put<KnowledgeBaseAgentBinding[]>(`/knowledge-bases/${knowledgeBaseId}/agents`, payload).then((r) => r.data),
  index: (knowledgeBaseId: string, payload: { job_type: KnowledgeBaseIndexJobType; source_id?: string | null }) =>
    apiClient.post<KnowledgeBaseIndexingJob>(`/knowledge-bases/${knowledgeBaseId}/index`, payload).then((r) => r.data),
  jobs: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseIndexingJob[]>(`/knowledge-bases/${knowledgeBaseId}/index/jobs`).then((r) => r.data),
  jobErrors: (jobId: string) =>
    apiClient.get<KnowledgeBaseIndexingError[]>(`/knowledge-bases/index/jobs/${jobId}/errors`).then((r) => r.data),
  testSearch: (knowledgeBaseId: string, payload: { query: string; top_k?: number; user_id?: string | null; department_id?: string | null; agent_id?: string | null }) =>
    apiClient.post<KnowledgeBaseTestSearchResponse>(`/knowledge-bases/${knowledgeBaseId}/test-search`, payload).then((r) => r.data),
  audit: (knowledgeBaseId: string) =>
    apiClient.get<Record<string, unknown>[]>(`/knowledge-bases/${knowledgeBaseId}/audit`).then((r) => r.data)
};
