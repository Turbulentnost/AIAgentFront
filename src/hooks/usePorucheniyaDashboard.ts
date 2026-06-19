import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { porucheniyaApi } from "@/api/endpoints";
import type { PorucheniyaDashboardRefreshPayload } from "@/types/porucheniya";
import { isMeetingDashboardForbidden } from "@/hooks/useMeetingDashboard";

export function usePorucheniyaPermissions() {
  return useQuery({
    queryKey: ["porucheniya", "permissions"],
    queryFn: porucheniyaApi.permissions
  });
}

export function usePorucheniyaDashboard(enabled = true) {
  return useQuery({
    queryKey: ["porucheniya", "dashboard"],
    queryFn: () => porucheniyaApi.getDashboard(),
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

/** F5 / mount → GET (кэш). Кнопка «Обновить» → POST refresh (всегда 1С). */
export function useRefreshPorucheniyaDashboard() {
  const queryClient = useQueryClient();

  return useCallback(async (payload?: PorucheniyaDashboardRefreshPayload) => {
    const dashboard = await porucheniyaApi.refreshDashboard(payload);
    queryClient.setQueryData(["porucheniya", "dashboard"], dashboard);
    return dashboard;
  }, [queryClient]);
}

const PORUCHENIYA_ONEC_ERROR_MESSAGE =
  "Не удалось получить данные из 1С ERP. Проверьте подключение и права доступа OData или обратитесь к администратору.";

const PORUCHENIYA_SERVER_ERROR_MESSAGE =
  "Не удалось загрузить поручения. Повторите попытку или обратитесь к администратору.";

function isPorucheniyaProfileErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("пользователь не найден") ||
    lower.includes("не найден пользователь") ||
    lower.includes("не удалось определить фио руководителя") ||
    lower.includes("не удалось определить ключ руководителя") ||
    lower.includes("проверьте фио в профиле")
  );
}

function isPorucheniyaOneCIntegrationErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  if (isPorucheniyaProfileErrorMessage(message)) return false;
  return (
    lower.includes("odata.error") ||
    lower.includes("http 401") ||
    lower.includes("http 403") ||
    lower.includes("http 500") ||
    lower.includes("econnrefused") ||
    lower.includes("доступ запрещен") ||
    lower.includes("onec_odata") ||
    (lower.includes("odata") && !lower.includes("пользователь"))
  );
}

export function formatPorucheniyaIntegrationError(message: string | null | undefined): string {
  if (!message?.trim()) return PORUCHENIYA_SERVER_ERROR_MESSAGE;
  if (isPorucheniyaProfileErrorMessage(message)) return message.trim();
  if (isPorucheniyaOneCIntegrationErrorMessage(message)) return PORUCHENIYA_ONEC_ERROR_MESSAGE;
  return message.trim();
}

export function getPorucheniyaRequestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return formatPorucheniyaIntegrationError(detail);
    }
    if (Array.isArray(detail)) {
      return formatPorucheniyaIntegrationError(
        detail.map((item) => item?.msg ?? String(item)).join("; ")
      );
    }
    const status = error.response?.status;
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      if (error.message) return formatPorucheniyaIntegrationError(error.message);
      return PORUCHENIYA_SERVER_ERROR_MESSAGE;
    }
    if (error.message) return formatPorucheniyaIntegrationError(error.message);
  }
  if (error instanceof Error && error.message) {
    return formatPorucheniyaIntegrationError(error.message);
  }
  return PORUCHENIYA_SERVER_ERROR_MESSAGE;
}

export const isPorucheniyaDashboardForbidden = isMeetingDashboardForbidden;
