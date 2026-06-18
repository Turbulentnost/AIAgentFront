import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { porucheniyaApi } from "@/api/endpoints";
import type { PorucheniyaDashboardRefreshPayload } from "@/types/porucheniya";
import {
  formatMeetingIntegrationError,
  getMeetingRequestError,
  isMeetingDashboardForbidden
} from "@/hooks/useMeetingDashboard";

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

export function useRefreshPorucheniyaDashboard() {
  const queryClient = useQueryClient();

  return useCallback(async (payload?: PorucheniyaDashboardRefreshPayload) => {
    const dashboard = await porucheniyaApi.refreshDashboard(payload);
    queryClient.setQueryData(["porucheniya", "dashboard"], dashboard);
    return dashboard;
  }, [queryClient]);
}

export const formatPorucheniyaIntegrationError = formatMeetingIntegrationError;
export const getPorucheniyaRequestError = getMeetingRequestError;
export const isPorucheniyaDashboardForbidden = isMeetingDashboardForbidden;
