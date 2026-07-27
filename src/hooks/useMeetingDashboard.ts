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

const OUTLOOK_INTEGRATION_ERROR_MESSAGE =
  "Не удалось подключиться к Outlook/Exchange для проверки календарей. Проверьте OUTLOOK_* в .env и доступ к mail-серверу из Docker.";

const MEETING_SERVER_ERROR_MESSAGE =
  "Не удалось выполнить операцию. Повторите попытку или обратитесь к администратору.";

const MEETING_CALENDAR_ERROR_MESSAGE =
  "Не удалось выполнить проверку календарей. Повторите попытку или обратитесь к администратору.";

const MEETING_PROTOCOL_ERROR_MESSAGE =
  "Не удалось создать протокол. Повторите попытку или обратитесь к администратору.";

function isOutlookIntegrationErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("outlook") ||
    lower.includes("exchange") ||
    lower.includes("ews") ||
    lower.includes("exchangelib") ||
    lower.includes("transporterror") ||
    lower.includes("invalid credentials") ||
    lower.includes("календар") ||
    lower.includes("free/busy") ||
    lower.includes("freebusy") ||
    lower.includes("mail.turbo-don") ||
    lower.includes("nameresolution") ||
    lower.includes("failed to resolve") ||
    lower.includes("no address associated with hostname")
  );
}

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
  if (!message?.trim()) return MEETING_SERVER_ERROR_MESSAGE;
  if (isOutlookIntegrationErrorMessage(message)) return OUTLOOK_INTEGRATION_ERROR_MESSAGE;
  if (isOneCIntegrationErrorMessage(message)) return ONEC_INTEGRATION_ERROR_MESSAGE;
  return message.trim();
}

export function isMeetingDashboardForbidden(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

export function getMeetingRequestError(error: unknown): string {
  return getMeetingActionError(error, MEETING_SERVER_ERROR_MESSAGE);
}

export function getMeetingCalendarError(error: unknown): string {
  return getMeetingActionError(error, MEETING_CALENDAR_ERROR_MESSAGE);
}

export function getMeetingProtocolError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      const message = "message" in data && typeof data.message === "string" ? data.message.trim() : "";
      if (message) return message;

      const detail = "detail" in data ? data.detail : undefined;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    }

    if (error.code === "ECONNABORTED") {
      return "Создание протокола в 1С заняло слишком много времени. Повторите попытку.";
    }
  }
  return getMeetingActionError(error, MEETING_PROTOCOL_ERROR_MESSAGE);
}

function getMeetingActionError(error: unknown, fallbackMessage: string): string {
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
      if (error.message) return formatMeetingIntegrationError(error.message);
      return fallbackMessage;
    }
    if (error.message) return formatMeetingIntegrationError(error.message);
  }
  if (error instanceof Error && error.message) {
    return formatMeetingIntegrationError(error.message);
  }
  return fallbackMessage;
}

/** Ошибки approve/reject — показываем detail/message с бэкенда, без ложной OData-ошибки. */
export function getMeetingMemoActionError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      const message = "message" in data && typeof data.message === "string" ? data.message.trim() : "";
      if (message) return message;

      const detail = "detail" in data ? data.detail : undefined;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
      if (detail && typeof detail === "object" && "message" in detail) {
        const detailMessage = detail.message;
        if (typeof detailMessage === "string" && detailMessage.trim()) return detailMessage.trim();
      }
    }

    if (error.code === "ECONNABORTED") {
      return "Операция в 1С заняла слишком много времени. Проверьте статус СЗ в 1С и обновите dashboard.";
    }

    const status = error.response?.status;
    if (status === 404) {
      return "Метод согласования/отклонения не найден на сервере. Перезапустите бэкенд с актуальной версией.";
    }
  }
  return getMeetingCalendarError(error);
}
