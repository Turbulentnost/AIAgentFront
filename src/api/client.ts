import axios from "axios";
import { API_BASE_URL } from "./config";

export const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

/** Долгие операции (LLM в конструкторе агентов и т.п.). */
export const longRunningApiClient = axios.create({ baseURL: API_BASE_URL, timeout: 600000 });

longRunningApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

longRunningApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_expires_at");
    }
    return Promise.reject(error);
  }
);
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_expires_at");
    }
    return Promise.reject(error);
  }
);
