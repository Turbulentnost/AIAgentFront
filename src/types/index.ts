export type AgentStatus = "draft" | "testing" | "ope" | "refinement" | "active" | "suspended" | "archived";
export type TaskStatus = "pending" | "planning" | "running" | "waiting_human" | "completed" | "completed_with_issues" | "failed" | "cancelled";
export interface Agent { id: string; name: string; slug: string; purpose: string | null; status: AgentStatus; department_id?: string | null; owner_id?: string | null; created_at: string; updated_at: string; }
export interface AgentAccess extends Agent { access_level: string | null; can_run: boolean; can_view_results: boolean; can_approve: boolean; can_configure: boolean; }
export interface Task { id: string; title: string; description: string | null; status: TaskStatus; task_type: string | null; requires_human_review: boolean; final_result: Record<string, unknown> | null; created_at: string; updated_at: string; }
export interface HealthResponse { status: string; environment: string; version: string; }
export interface TokenResponse { access_token: string; token_type: "bearer"; expires_at: string | null; }
export interface LoginPayload { email: string; password: string; }
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
export interface DepartmentCreate { name: string; slug: string; description?: string; parent_id?: string | null; is_active?: boolean; }
