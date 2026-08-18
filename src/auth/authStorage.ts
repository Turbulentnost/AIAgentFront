/** Хранилище токена: sessionStorage в desktop (без автологина), localStorage в web. */
export function getAuthStorage(): Storage {
  if (typeof document !== "undefined" && document.documentElement.dataset.aveonDesktop === "1") {
    return sessionStorage;
  }
  return localStorage;
}

export function readAccessToken(): string | null {
  return getAuthStorage().getItem("access_token");
}

export function clearAuthTokens(): void {
  for (const storage of [getAuthStorage(), localStorage, sessionStorage]) {
    storage.removeItem("access_token");
    storage.removeItem("token_expires_at");
  }
}

export function writeAuthTokens(accessToken: string, expiresAt?: string | null): void {
  const storage = getAuthStorage();
  storage.setItem("access_token", accessToken);
  if (expiresAt) storage.setItem("token_expires_at", expiresAt);
  else storage.removeItem("token_expires_at");
}
