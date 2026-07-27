import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { meetingsApi } from "@/api/endpoints";
import type {
  MeetingRunCreate,
  MeetingSlotsRequest,
  MeetingAgentSlotApproveRequest,
  MeetingAgentSlotPreviewDetailsRequest,
  MeetingMemoRejectRequest,
  MeetingMemoApproveRequest,
  MeetingMemoSeriesPlanningChoiceRequest,
  MeetingMemoSeriesCreateRequest,
  MeetingTopicCheckSimilarRequest,
  MeetingTopicResolveRequest
} from "@/types/meetings";
import { meetingScheduleQueryKey } from "@/hooks/useMeetingSchedule";

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

export function useMeetingAgentSlotPreviewDetails() {
  return useMutation({
    mutationFn: ({
      memoRefKey,
      payload
    }: {
      memoRefKey: string;
      payload: MeetingAgentSlotPreviewDetailsRequest;
    }) => meetingsApi.slotPreviewDetails(memoRefKey, payload)
  });
}

export function useMeetingMemoReject() {
  return useMutation({
    mutationFn: ({
      memoRefKey,
      payload
    }: {
      memoRefKey: string;
      payload: MeetingMemoRejectRequest;
    }) => meetingsApi.rejectMemo(memoRefKey, payload)
  });
}

export function useMeetingMemoApprove() {
  return useMutation({
    mutationFn: ({
      memoRefKey,
      payload
    }: {
      memoRefKey: string;
      payload?: MeetingMemoApproveRequest;
    }) => meetingsApi.approveMemo(memoRefKey, payload)
  });
}

export function useMeetingTopicCheckSimilar() {
  return useMutation({
    mutationFn: (payload: MeetingTopicCheckSimilarRequest) => meetingsApi.checkSimilarTopic(payload)
  });
}

export function useMeetingTopicResolve() {
  return useMutation({
    mutationFn: (payload: MeetingTopicResolveRequest) => meetingsApi.resolveTopic(payload)
  });
}

export function useMeetingMemoSeriesPlanningChoice() {
  return useMutation({
    mutationFn: ({
      memoRefKey,
      mode
    }: {
      memoRefKey: string;
      mode: MeetingMemoSeriesPlanningChoiceRequest["mode"];
    }) => meetingsApi.saveSeriesPlanningChoice(memoRefKey, { mode })
  });
}

export function useMeetingMemoCreateSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { memoRefKey: string; payload?: MeetingMemoSeriesCreateRequest }) =>
      meetingsApi.createSeriesFromMemo(input.memoRefKey, input.payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meetingScheduleQueryKey });
    }
  });
}
