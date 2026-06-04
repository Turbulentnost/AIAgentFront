import axios from "axios";
export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api/v1", timeout: 30000 });
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
