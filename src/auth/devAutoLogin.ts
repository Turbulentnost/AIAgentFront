/** Local/dev: magic-link auto-login via POST /auth/dev-auto-login. */
export function isDevAutoLoginEnabled(): boolean {
  return import.meta.env.VITE_DEV_AUTO_LOGIN === "true";
}

export const DEV_AUTO_LOGIN_DEFAULT_REDIRECT = "/agents/procurement-manager";

/** Only same-origin relative paths; blocks open redirects. */
export function safeAuthRedirect(raw: string | null | undefined): string {
  const fallback = DEV_AUTO_LOGIN_DEFAULT_REDIRECT;
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return fallback;
  }
  return value;
}
