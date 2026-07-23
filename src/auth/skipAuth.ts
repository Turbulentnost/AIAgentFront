import type { User } from "@/types";

/** Local/dev: UI без формы логина (только при VITE_SKIP_AUTH=true). */
export function isSkipAuth(): boolean {
  return import.meta.env.VITE_SKIP_AUTH === "true";
}

/** Mock superuser для шапки / админ-кнопок при skip-auth. */
export const SKIP_AUTH_MOCK_USER: User = {
  id: "00000000-0000-0000-0000-0000000000de",
  email: "dev@local",
  username: "dev",
  last_name: "Dev",
  first_name: "Local",
  middle_name: null,
  full_name: "Local Dev (skip-auth)",
  phone: null,
  position: "Developer",
  is_active: true,
  is_superuser: true,
  is_verified: true,
  must_change_password: false,
  department_id: null,
  role_id: null,
  avatar_url: null,
  last_login_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};
