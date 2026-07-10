import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { meetingsApi } from "@/api/endpoints";
import type { MeetingRegistryContext, MeetingRegistryStageFilter } from "@/types/meetings";
import { patchRegistryContextAfterCancel, patchRegistryContextAfterReschedule, registryStageQueryParam } from "@/utils/meetingRegistry";

export function useMeetingRegistry(enabled = true, stageFilter: MeetingRegistryStageFilter = "all") {
  const stage = registryStageQueryParam(stageFilter);

  return useQuery({
    queryKey: ["meetings", "registry", stageFilter],
    queryFn: () => meetingsApi.getRegistry(stage),
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

export function useRefreshMeetingRegistry() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["meetings", "registry"] });
  }, [queryClient]);
}

export function useMeetingRegistryCancel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ refKey, message }: { refKey: string; message?: string }) =>
      meetingsApi.cancelRegistryMeeting(refKey, { message: message ?? "" }),
    onSuccess: (result, { refKey }) => {
      const queries = queryClient.getQueriesData<MeetingRegistryContext>({
        queryKey: ["meetings", "registry"]
      });

      for (const [queryKey, data] of queries) {
        if (!data) continue;
        const stageFilter = (queryKey[2] as MeetingRegistryStageFilter | undefined) ?? "all";
        queryClient.setQueryData(
          queryKey,
          patchRegistryContextAfterCancel(data, refKey, result, stageFilter)
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry"] });
    }
  });
}

export function useMeetingRegistryRescheduleSlotPreview() {
  return useMutation({
    mutationFn: ({
      refKey,
      durationMinutes
    }: {
      refKey: string;
      durationMinutes?: number;
    }) =>
      meetingsApi.rescheduleSlotPreview(
        refKey,
        durationMinutes ? { duration_minutes: durationMinutes } : undefined
      )
  });
}

export function useMeetingRegistryRescheduleApprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      refKey,
      payload
    }: {
      refKey: string;
      payload: Parameters<typeof meetingsApi.approveRegistryReschedule>[1];
    }) => meetingsApi.approveRegistryReschedule(refKey, payload),
    onSuccess: (result, { refKey }) => {
      const queries = queryClient.getQueriesData<MeetingRegistryContext>({
        queryKey: ["meetings", "registry"]
      });

      for (const [queryKey, data] of queries) {
        if (!data) continue;
        const stageFilter = (queryKey[2] as MeetingRegistryStageFilter | undefined) ?? "all";
        queryClient.setQueryData(
          queryKey,
          patchRegistryContextAfterReschedule(data, refKey, result, stageFilter)
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry"] });
      void queryClient.invalidateQueries({ queryKey: ["meetings", "memo-detail", refKey] });
    }
  });
}
