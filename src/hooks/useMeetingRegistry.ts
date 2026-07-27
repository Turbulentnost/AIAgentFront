import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { meetingsApi } from "@/api/endpoints";
import type {
  MeetingRegistryContext,
  MeetingRegistryParticipantsApplyRequest,
  MeetingRegistryParticipantsAddConfirmRequest,
  MeetingRegistryParticipantsRemovalConfirmRequest,
  MeetingRegistryProtocolCreateResponse,
  MeetingRegistryStageFilter
} from "@/types/meetings";
import {
  patchRegistryContextAfterCancel,
  patchRegistryContextAfterParticipantsApply,
  patchRegistryContextAfterParticipantsAddConfirm,
  patchRegistryContextAfterParticipantsRemovalConfirm,
  patchRegistryContextAfterProtocolCreate,
  patchRegistryContextAfterReschedule,
  registryStageQueryParam
} from "@/utils/meetingRegistry";

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
        if (!data || !Array.isArray(data.items)) continue;
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
      durationMinutes,
      signal
    }: {
      refKey: string;
      durationMinutes?: number;
      signal?: AbortSignal;
    }) =>
      meetingsApi.rescheduleSlotPreview(
        refKey,
        durationMinutes ? { duration_minutes: durationMinutes } : undefined,
        { signal }
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
        if (!data || !Array.isArray(data.items)) continue;
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

export function useMeetingRegistryParticipants(refKey: string | null, enabled = false) {
  return useQuery({
    queryKey: ["meetings", "registry", "participants", refKey],
    queryFn: () => meetingsApi.getRegistryParticipants(refKey!),
    enabled: enabled && Boolean(refKey),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)) {
        return false;
      }
      return failureCount < 1;
    }
  });
}

export function useMeetingRegistryParticipantsApply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      refKey,
      payload
    }: {
      refKey: string;
      payload: MeetingRegistryParticipantsApplyRequest;
    }) => meetingsApi.applyRegistryParticipants(refKey, payload),
    onSuccess: (result, { refKey }) => {
      if (result.pending_confirmation) {
        return;
      }

      const queries = queryClient.getQueriesData<MeetingRegistryContext>({
        queryKey: ["meetings", "registry"]
      });

      for (const [queryKey, data] of queries) {
        if (!data || !Array.isArray(data.items)) continue;
        queryClient.setQueryData(
          queryKey,
          patchRegistryContextAfterParticipantsApply(data, refKey, result)
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry"] });
      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry", "participants", refKey] });
    }
  });
}

export function useMeetingRegistryParticipantsConfirmAdd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      refKey,
      payload
    }: {
      refKey: string;
      payload: MeetingRegistryParticipantsAddConfirmRequest;
    }) => meetingsApi.confirmRegistryParticipantsAdd(refKey, payload),
    onSuccess: (result, { refKey }) => {
      const queries = queryClient.getQueriesData<MeetingRegistryContext>({
        queryKey: ["meetings", "registry"]
      });

      for (const [queryKey, data] of queries) {
        if (!data || !Array.isArray(data.items)) continue;
        queryClient.setQueryData(
          queryKey,
          patchRegistryContextAfterParticipantsAddConfirm(data, refKey, result)
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry"] });
      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry", "participants", refKey] });
      void queryClient.invalidateQueries({ queryKey: ["meetings", "memo-detail", refKey] });
    }
  });
}

export function useMeetingRegistryParticipantsConfirmRemoval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      refKey,
      payload
    }: {
      refKey: string;
      payload: MeetingRegistryParticipantsRemovalConfirmRequest;
    }) => meetingsApi.confirmRegistryParticipantsRemoval(refKey, payload),
    onSuccess: (result, { refKey }) => {
      const queries = queryClient.getQueriesData<MeetingRegistryContext>({
        queryKey: ["meetings", "registry"]
      });

      for (const [queryKey, data] of queries) {
        if (!data || !Array.isArray(data.items)) continue;
        queryClient.setQueryData(
          queryKey,
          patchRegistryContextAfterParticipantsRemovalConfirm(data, refKey, result)
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry"] });
      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry", "participants", refKey] });
      void queryClient.invalidateQueries({ queryKey: ["meetings", "memo-detail", refKey] });
    }
  });
}

export function useMeetingRegistryCreateProtocol() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ refKey }: { refKey: string }) => meetingsApi.createRegistryProtocol(refKey),
    onSuccess: (result, { refKey }) => {
      const queries = queryClient.getQueriesData<MeetingRegistryContext>({
        queryKey: ["meetings", "registry"]
      });

      for (const [queryKey, data] of queries) {
        if (!data || !Array.isArray(data.items)) continue;
        const stageFilter = (queryKey[2] as MeetingRegistryStageFilter | undefined) ?? "all";
        queryClient.setQueryData(
          queryKey,
          patchRegistryContextAfterProtocolCreate(data, refKey, result, stageFilter)
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry"] });
    }
  });
}

export function useMeetingRegistryParticipantsCancelRemoval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ refKey }: { refKey: string }) =>
      meetingsApi.cancelRegistryParticipantsRemoval(refKey),
    onSuccess: (_result, { refKey }) => {
      void queryClient.invalidateQueries({ queryKey: ["meetings", "registry", "participants", refKey] });
    }
  });
}
