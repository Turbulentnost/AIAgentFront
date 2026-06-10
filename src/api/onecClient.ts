import axios from "axios";
import { ONEC_API_BASE_URL, ONEC_API_SERVER } from "./onecConfig";
import { apiClient } from "./client";
import { clearOneCSession } from "@/auth/onecSession";

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

onecApiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export async function invalidateOneCSession(): Promise<void> {
  clearOneCSession();
  try {
    await apiClient.delete("/auth/onec/session");
  } catch {
    // Best-effort cleanup: local state must still be cleared.
  } finally {
    window.dispatchEvent(new Event("onec-session-invalidated"));
  }
}

export async function checkOneCHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${ONEC_API_SERVER}/health`, { timeout: 5_000 });
    return response.data?.status === "ok";
  } catch {
    return false;
  }
}
