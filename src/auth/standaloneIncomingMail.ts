import type { User } from "@/types";

/** Локальный UI входящей почты без platform API (5454) и без логина. */
export function isStandaloneIncomingMail(): boolean {
  return import.meta.env.VITE_STANDALONE_INCOMING_MAIL === "true";
}

/** /agents/incoming-mail доступен без авторизации на платформе. */
export function isIncomingMailPublic(): boolean {
  if (isStandaloneIncomingMail()) return true;
  const flag = import.meta.env.VITE_INCOMING_MAIL_PUBLIC;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return import.meta.env.DEV;
}

export const STANDALONE_MOCK_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "incoming-mail@local",
  username: "incoming-mail",
  last_name: null,
  first_name: "Оператор",
  middle_name: null,
  full_name: "Оператор входящей почты",
  phone: null,
  position: "Входящая корреспонденция",
  is_active: true,
  is_superuser: false,
  is_verified: true,
  must_change_password: false,
  department_id: null,
  role_id: null,
  avatar_url: null,
  last_login_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};
