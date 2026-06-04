import { apiClient } from "./client";
import type {
  AdminUserCreate,
  Agent,
  AgentAccess,
  Department,
  DepartmentCreate,
  HealthResponse,
  LoginPayload,
  Task,
  TokenResponse,
  User,
  UserUpdate
} from "@/types";

export const healthApi = { get: () => apiClient.get<HealthResponse>("/health").then((r) => r.data) };
export const authApi = {
  login: (payload: LoginPayload) => apiClient.post<TokenResponse>("/auth/login", payload).then((r) => r.data),
  me: () => apiClient.get<User>("/auth/me").then((r) => r.data),
  logout: () => apiClient.post("/auth/logout").then((r) => r.data)
};
export const adminUsersApi = {
  list: () => apiClient.get<User[]>("/admin/users").then((r) => r.data),
  create: (payload: AdminUserCreate) => apiClient.post<User>("/admin/users", payload).then((r) => r.data),
  deactivate: (userId: string) => apiClient.post<User>(`/admin/users/${userId}/deactivate`).then((r) => r.data)
};
export const usersApi = {
  list: () => apiClient.get<User[]>("/users").then((r) => r.data),
  update: (userId: string, payload: UserUpdate) => apiClient.patch<User>(`/users/${userId}`, payload).then((r) => r.data),
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
export const tasksApi = { list: () => apiClient.get<Task[]>("/tasks").then((r) => r.data) };
export const documentsApi = { search: (query: string, topK = 5) => apiClient.post("/documents/search", { query, top_k: topK }).then((r) => r.data) };
