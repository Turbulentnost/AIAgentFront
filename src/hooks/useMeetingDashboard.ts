import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { meetingsApi } from "@/api/endpoints";

export function useMeetingPermissions() {
  return useQuery({
    queryKey: ["meetings", "permissions"],
    queryFn: meetingsApi.permissions
  });
}

export function useMeetingDashboard(enabled = true) {
  return useQuery({
    queryKey: ["meetings", "dashboard"],
    queryFn: meetingsApi.getDashboard,
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 403) return false;
      return failureCount < 1;
    }
  });
}

/** F5 / mount → GET (Redis-кэш). Кнопка «Обновить» → POST refresh (всегда 1С). */
export function useRefreshMeetingDashboard() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    const dashboard = await meetingsApi.refreshDashboard();
    queryClient.setQueryData(["meetings", "dashboard"], dashboard);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meetings", "memo-detail"] }),
      queryClient.invalidateQueries({ queryKey: ["meetings", "slots"] })
    ]);

    return dashboard;
  }, [queryClient]);
}

const ONEC_INTEGRATION_ERROR_MESSAGE =
  "Не удалось получить данные из 1С ERP. Проверьте подключение и права доступа OData или обратитесь к администратору.";

function isOneCIntegrationErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("odata.error") ||
    lower.includes("http 401") ||
    lower.includes("http 403") ||
    lower.includes("http 500") ||
    lower.includes("request failed with status code") ||
    lower.includes("network error") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused") ||
    lower.includes("доступ запрещен") ||
    lower.includes("onec") ||
    lower.includes("1с") ||
    lower.includes("odata") ||
    (lower.startsWith("http ") && lower.includes("{"))
  );
}

export function formatMeetingIntegrationError(message: string | null | undefined): string {
  if (!message?.trim()) return ONEC_INTEGRATION_ERROR_MESSAGE;
  if (isOneCIntegrationErrorMessage(message)) return ONEC_INTEGRATION_ERROR_MESSAGE;
  return message.trim();
}

export function isMeetingDashboardForbidden(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

export function getMeetingRequestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return formatMeetingIntegrationError(detail);
    }
    if (Array.isArray(detail)) {
      return formatMeetingIntegrationError(
        detail.map((item) => item?.msg ?? String(item)).join("; ")
      );
    }
    const status = error.response?.status;
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      return ONEC_INTEGRATION_ERROR_MESSAGE;
    }
    if (error.message) return formatMeetingIntegrationError(error.message);
  }
  if (error instanceof Error && error.message) {
    return formatMeetingIntegrationError(error.message);
  }
  return ONEC_INTEGRATION_ERROR_MESSAGE;
}
