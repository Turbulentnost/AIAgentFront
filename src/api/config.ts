/** Хост API (без localhost — доступ по LAN). */
export function resolveApiServer(): string {
  return import.meta.env.VITE_API_SERVER || "http://127.0.0.1:5454";
}

/** Через прокси на :5151 (/api → backend :5252) — и в dev, и в prod-сборке на deploy-машине. */
export function resolveApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || "/api/v1";
}

export const API_SERVER = resolveApiServer();
export const API_BASE_URL = resolveApiBaseUrl();
