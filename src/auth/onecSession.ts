import type { OneCSession, User } from "@/types";

const TOKEN_KEY = "onec_token";
const SESSION_KEY = "onec_session";
const ONEC_TOKEN_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export function getOneCToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getOneCSession(): OneCSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OneCSession;
  } catch {
    return null;
  }
}

export function hasOneCSession(): boolean {
  return isOneCSessionValid(getOneCSession());
}

export function isOneCSessionValid(session: OneCSession | null = getOneCSession()): boolean {
  if (!session?.token) return false;
  if (session.token_created_at) {
    const createdAt = new Date(session.token_created_at).getTime();
    if (!Number.isNaN(createdAt) && Date.now() - createdAt >= ONEC_TOKEN_MAX_AGE_MS) {
      return false;
    }
  }
  return true;
}

export function saveOneCSession(session: OneCSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearOneCSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function buildOneCUser(session: OneCSession): User {
  const fullName = session.resolved_user || session.fio;
  const parts = fullName.trim().split(/\s+/);
  const [lastName, firstName, middleName] = parts;

  return {
    id: `onec:${session.token.slice(0, 12)}`,
    email: "",
    username: null,
    last_name: lastName ?? null,
    first_name: firstName ?? null,
    middle_name: middleName ?? null,
    full_name: fullName,
    phone: null,
    position: null,
    is_active: true,
    is_superuser: false,
    is_verified: true,
    must_change_password: false,
    department_id: null,
    role_id: null,
    avatar_url: null,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
