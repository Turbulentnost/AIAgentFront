import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { meetingsApi } from "@/api/endpoints";
import type {
  MeetingRunCreate,
  MeetingSlotsRequest,
  MeetingAgentSlotApproveRequest
} from "@/types/meetings";

const RUNNING_STATUSES = new Set(["pending", "planning", "running", "waiting_human"]);

export function useMeetingMemoDetail(
  memoRefKey: string | null,
  enabled = true,
  forceRefresh = false
) {
  return useQuery({
    queryKey: ["meetings", "memo-detail", memoRefKey, forceRefresh ? "refresh" : "cache"],
    queryFn: () => meetingsApi.getMemoDetail(memoRefKey!, { forceRefresh }),
    enabled: enabled && Boolean(memoRefKey),
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 400) return false;
      return failureCount < 1;
    }
  });
}

export function useMeetingSlots(payload: MeetingSlotsRequest | null, enabled = true) {
  return useQuery({
    queryKey: ["meetings", "slots", payload],
    queryFn: () => meetingsApi.findSlots(payload!),
    enabled: enabled && Boolean(payload?.memo_ref_key),
    retry: 1
  });
}

export function useMeetingRunResult(taskId: string | null) {
  return useQuery({
    queryKey: ["meetings", "runs", taskId],
    queryFn: () => meetingsApi.getRun(taskId!),
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && RUNNING_STATUSES.has(status) ? 2000 : false;
    }
  });
}

export function useCreateMeetingRun() {
  return useMutation({
    mutationFn: (payload: MeetingRunCreate) => meetingsApi.createRun(payload)
  });
}

export function useMeetingAgentSlotPreview() {
  return useMutation({
    mutationFn: ({
      memoRefKey,
      durationMinutes
    }: {
      memoRefKey: string;
      durationMinutes?: number | null;
    }) =>
      meetingsApi.slotPreview(
        memoRefKey,
        durationMinutes ? { duration_minutes: durationMinutes } : undefined
      )
  });
}

export function useMeetingAgentSlotApprove() {
  return useMutation({
    mutationFn: ({
      memoRefKey,
      payload
    }: {
      memoRefKey: string;
      payload: MeetingAgentSlotApproveRequest;
    }) => meetingsApi.approveSlot(memoRefKey, payload)
  });
}
