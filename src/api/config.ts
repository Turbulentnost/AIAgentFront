/** Хост API (без localhost — доступ по LAN). */
export const API_SERVER = import.meta.env.VITE_API_SERVER || "http://192.168.1.157:5454";

/** Через прокси на :5151 (/api → backend :5252) — и в dev, и в prod-сборке на deploy-машине. */
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";
