import type { OneCSession, User } from "@/types";

const TOKEN_KEY = "onec_token";
const SESSION_KEY = "onec_session";
const CREDENTIALS_KEY = "onec_credentials";
const ONEC_TOKEN_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export interface OneCCredentials {
  fio: string;
  password: string;
}

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
  if (session.token) localStorage.setItem(TOKEN_KEY, session.token);
  else localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearOneCSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(CREDENTIALS_KEY);
}

export function saveOneCCredentials(credentials: OneCCredentials): void {
  sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function getOneCCredentials(): OneCCredentials | null {
  const raw = sessionStorage.getItem(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw) as OneCCredentials;
    if (!credentials.fio || !credentials.password) return null;
    return credentials;
  } catch {
    return null;
  }
}

export function hasOneCCredentials(): boolean {
  return getOneCCredentials() !== null;
}

export function buildOneCUser(session: OneCSession): User {
  const fullName = session.resolved_user || session.fio;
  const parts = fullName.trim().split(/\s+/);
  const [lastName, firstName, middleName] = parts;

  return {
    id: `onec:${fullName}`,
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
