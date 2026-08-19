import { readAccessToken } from "@/auth/authStorage";
import { resolveApiBaseUrl } from "@/api/config";
import { authApi } from "@/api/endpoints";
import type { LoginPayload, TokenResponse, User } from "@/types";

function isDesktopApp(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.aveonDesktop === "1";
}

async function desktopFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = readAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(detail || `HTTP ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

const desktopAuthApi = {
  login: (payload: LoginPayload) =>
    desktopFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  me: () => desktopFetch<User>("/auth/me"),
  logout: () => desktopFetch<void>("/auth/logout", { method: "POST" })
};

export function platformAuthApi() {
  return isDesktopApp() ? desktopAuthApi : authApi;
}
