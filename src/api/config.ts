/** Хост API (без localhost — доступ по LAN). */
export const API_SERVER = import.meta.env.VITE_API_SERVER || "http://192.168.1.157:5454";

export const API_BASE_URL = import.meta.env.VITE_API_URL || `${API_SERVER}/api/v1`;
