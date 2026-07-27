import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { notificationsApi } from "@/api/endpoints";
import { useMeetingPermissions } from "@/hooks/useMeetingDashboard";
import type { AppNotificationAcceptRequest } from "@/types/notifications";

export const notificationsQueryKey = ["notifications"] as const;

export function useNotifications(enabled = true) {
  const permissionsQuery = useMeetingPermissions();
  const canAccess = permissionsQuery.data?.can_access_agent === true;

  const listQuery = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: notificationsApi.list,
    enabled: enabled && canAccess,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 401)) {
        return false;
      }
      return failureCount < 1;
    }
  });

  return {
    ...listQuery,
    canAccess,
    permissionsLoading: permissionsQuery.isLoading
  };
}

export function useOpenNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.open(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    }
  });
}

export function useAcceptNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      notificationId,
      payload
    }: {
      notificationId: string;
      payload?: AppNotificationAcceptRequest;
    }) => notificationsApi.accept(notificationId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["meetings", "scheduled"] });
    }
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.dismiss(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    }
  });
}

export function getNotificationError(error: unknown, fallback = "Не удалось выполнить действие"): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (Array.isArray(detail)) {
      return detail.map((item) => item?.msg ?? String(item)).join("; ");
    }
    if (error.code === "ECONNABORTED") {
      return "Операция заняла слишком много времени. Повторите попытку.";
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
