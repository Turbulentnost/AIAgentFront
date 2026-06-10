import type { OneCTasksResponse } from "@/types";
import { invalidateOneCSession, onecApiClient } from "./onecClient";
import { getOneCCredentials } from "@/auth/onecSession";

function isOneCSessionAuthError(error: unknown): boolean {
  const axiosError = error as {
    response?: { status?: number; data?: { detail?: { code?: string } | string } };
  };
  if (axiosError.response?.status !== 401) return false;
  const detail = axiosError.response.data?.detail;
  if (typeof detail === "object" && detail?.code) {
    return detail.code === "onec_session_expired" || detail.code === "onec_session_invalid";
  }
  return false;
}

export const onecTasksApi = {
  list: async () => {
    const credentials = getOneCCredentials();
    if (!credentials) {
      throw new Error("Для загрузки задач 1С нужно заново войти через 1С.");
    }
    try {
      return await onecApiClient
        .post<OneCTasksResponse>("/tasks", credentials, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json"
          }
        })
        .then((response) => response.data);
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status === 401 || isOneCSessionAuthError(error)) {
        await invalidateOneCSession();
      }
      throw error;
    }
  }
};
