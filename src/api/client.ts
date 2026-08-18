import axios from "axios";
import { resolveApiBaseUrl } from "@/api/config";

function applyAuthHeader(config: import("axios").InternalAxiosRequestConfig) {
  config.baseURL = resolveApiBaseUrl();
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}

export const apiClient = axios.create({ timeout: 30000 });

/** Долгие операции (LLM в конструкторе агентов и т.п.). */
export const longRunningApiClient = axios.create({ timeout: 600000 });

longRunningApiClient.interceptors.request.use(applyAuthHeader);

function isOneCSessionAuthError(error: unknown): boolean {
  const detail = (error as { response?: { data?: { detail?: { code?: string } | string } } })?.response?.data
    ?.detail;
  if (typeof detail !== "object" || !detail?.code) return false;
  return detail.code === "onec_session_expired" || detail.code === "onec_session_invalid";
}

longRunningApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isOneCSessionAuthError(error)) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_expires_at");
    }
    return Promise.reject(error);
  }
);

apiClient.interceptors.request.use(applyAuthHeader);
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isOneCSessionAuthError(error)) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_expires_at");
    }
    return Promise.reject(error);
  }
);
