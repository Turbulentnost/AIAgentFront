/** Хост API (без localhost — доступ по LAN). */
export const API_SERVER = import.meta.env.VITE_API_SERVER || "http://192.168.1.157:5454";

/** В dev ходим через Vite proxy (/api → backend), чтобы не ловить CORS и неверный IP. */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/api/v1" : `${API_SERVER}/api/v1`);
