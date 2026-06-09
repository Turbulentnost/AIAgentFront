import axios from "axios";
import { ONEC_API_BASE_URL, ONEC_API_SERVER } from "./onecConfig";
import { apiClient } from "./client";
import { getOneCToken, clearOneCSession } from "@/auth/onecSession";

const defaultHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  Accept: "application/json"
};

/** Обычные запросы к 1С (список задач ~8–15 с). */
export const onecApiClient = axios.create({
  baseURL: ONEC_API_BASE_URL,
  timeout: 90_000,
  headers: defaultHeaders
});

onecApiClient.interceptors.request.use((config) => {
  const token = getOneCToken();
  if (token) {
    if (typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
      config.headers.set("X-Auth-Token", token);
    } else {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers["X-Auth-Token"] = token;
    }
    config.params = { ...(config.params ?? {}), token };
  }
  return config;
});

onecApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearOneCSession();
      void apiClient
        .delete("/auth/onec/session")
        .catch(() => undefined)
        .finally(() => window.dispatchEvent(new Event("onec-session-invalidated")));
    }
    return Promise.reject(error);
  }
);

export async function checkOneCHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${ONEC_API_SERVER}/health`, { timeout: 5_000 });
    return response.data?.status === "ok";
  } catch {
    return false;
  }
}
