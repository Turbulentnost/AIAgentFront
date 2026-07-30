import axios, { type InternalAxiosRequestConfig } from "axios";
import { isSkipAuth } from "@/auth/skipAuth";
import { API_BASE_URL } from "./config";

export const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

/** Долгие операции (LLM в конструкторе агентов и т.п.). */
export const longRunningApiClient = axios.create({ baseURL: API_BASE_URL, timeout: 600000 });

function attachAuthHeader(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (isSkipAuth()) return config;
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}

longRunningApiClient.interceptors.request.use((config) => attachAuthHeader(config));

function isOneCSessionAuthError(error: unknown): boolean {
  const detail = (error as { response?: { data?: { detail?: { code?: string } | string } } })?.response?.data
    ?.detail;
  if (typeof detail !== "object" || !detail?.code) return false;
  return detail.code === "onec_session_expired" || detail.code === "onec_session_invalid";
}

longRunningApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isOneCSessionAuthError(error) && !isSkipAuth()) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_expires_at");
    }
    return Promise.reject(error);
  }
);
apiClient.interceptors.request.use((config) => attachAuthHeader(config));
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isOneCSessionAuthError(error) && !isSkipAuth()) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_expires_at");
    }
    return Promise.reject(error);
  }
);
