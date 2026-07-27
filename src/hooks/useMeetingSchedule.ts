import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { meetingsApi } from "@/api/endpoints";
import type {
  MeetingScheduleContext,
  MeetingScheduleSeriesSavePayload,
  ScheduledMeetingRead
} from "@/types/meetings";
import {
  incrementMeetingScheduleTypeCounts,
  mapScheduleFormToApiPayload,
  mapScheduleFormToUpdatePayload,
  mapScheduledMeetingReadToSeriesItem,
  mapScheduledMeetingsToContext,
  updateMeetingScheduleItem
} from "@/utils/meetingScheduleApi";

export const meetingScheduleQueryKey = ["meetings", "schedule"] as const;

export type MeetingScheduleQueryData = {
  context: MeetingScheduleContext;
  seriesById: Record<string, ScheduledMeetingRead>;
};

const emptyScheduleContext = (): MeetingScheduleContext => ({
  type_counts: { total: 0, planned: 0, report: 0, selector: 0, unplanned: 0 },
  items: [],
  fetched_at: new Date().toISOString()
});

const emptyScheduleQueryData = (): MeetingScheduleQueryData => ({
  context: emptyScheduleContext(),
  seriesById: {}
});

function buildScheduleQueryData(items: ScheduledMeetingRead[]): MeetingScheduleQueryData {
  return {
    context: mapScheduledMeetingsToContext(items),
    seriesById: Object.fromEntries(items.map((item) => [item.id, item]))
  };
}

function upsertScheduleSeries(
  data: MeetingScheduleQueryData,
  read: ScheduledMeetingRead
): MeetingScheduleQueryData {
  return {
    context: updateMeetingScheduleItem(data.context, read),
    seriesById: {
      ...data.seriesById,
      [read.id]: read
    }
  };
}

function addScheduleSeries(
  data: MeetingScheduleQueryData,
  read: ScheduledMeetingRead
): MeetingScheduleQueryData {
  const item = mapScheduledMeetingReadToSeriesItem(read);
  const hasItem = data.context.items.some((existing) => existing.id === item.id);

  return {
    context: {
      ...data.context,
      fetched_at: new Date().toISOString(),
      items: hasItem ? data.context.items : [...data.context.items, item],
      type_counts: hasItem
        ? data.context.type_counts
        : incrementMeetingScheduleTypeCounts(data.context.type_counts, item.type)
    },
    seriesById: {
      ...data.seriesById,
      [read.id]: read
    }
  };
}

async function fetchMeetingSchedule(): Promise<MeetingScheduleQueryData> {
  try {
    const items = await meetingsApi.getSchedule();
    return buildScheduleQueryData(items);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return emptyScheduleQueryData();
    }
    throw error;
  }
}

export function useMeetingSchedule(enabled = true) {
  return useQuery({
    queryKey: meetingScheduleQueryKey,
    queryFn: fetchMeetingSchedule,
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 403) return false;
      return failureCount < 1;
    },
    select: (data) => data.context
  });
}

export function useMeetingScheduleDetail(seriesId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...meetingScheduleQueryKey, "detail", seriesId],
    queryFn: () => meetingsApi.getScheduledDetail(seriesId as string),
    enabled: enabled && Boolean(seriesId),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)) {
        return false;
      }
      return failureCount < 1;
    }
  });
}

export function useMeetingScheduleSeriesForEdit(meetingId: string | null, enabled = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...meetingScheduleQueryKey, "edit", meetingId],
    queryFn: () => meetingsApi.getScheduled(meetingId as string),
    enabled: enabled && Boolean(meetingId),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    placeholderData: () => {
      if (!meetingId) return undefined;
      const cached = queryClient.getQueryData<MeetingScheduleQueryData>(meetingScheduleQueryKey);
      return cached?.seriesById[meetingId];
    },
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)) {
        return false;
      }
      return failureCount < 1;
    }
  });
}

export function useMeetingScheduleCreateSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MeetingScheduleSeriesSavePayload) => {
      const apiPayload = mapScheduleFormToApiPayload(payload);
      return meetingsApi.createScheduled(apiPayload);
    },
    onSuccess: (read) => {
      queryClient.setQueryData<MeetingScheduleQueryData>(meetingScheduleQueryKey, (current) => {
        const base = current ?? emptyScheduleQueryData();
        return addScheduleSeries(base, read);
      });

      void queryClient.invalidateQueries({ queryKey: meetingScheduleQueryKey });
    }
  });
}

export function useMeetingSchedulePlanSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meetingId: string) => meetingsApi.planScheduled(meetingId),
    onSuccess: (read) => {
      queryClient.setQueryData<MeetingScheduleQueryData>(meetingScheduleQueryKey, (current) => {
        const base = current ?? emptyScheduleQueryData();
        return upsertScheduleSeries(base, read);
      });
      void queryClient.invalidateQueries({ queryKey: meetingScheduleQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...meetingScheduleQueryKey, "detail"] });
    }
  });
}

export function useMeetingScheduleCancelSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { meetingId: string; message?: string }) =>
      meetingsApi.cancelScheduled(input.meetingId, { message: input.message ?? "" }),
    onSuccess: (result) => {
      queryClient.setQueryData<MeetingScheduleQueryData>(meetingScheduleQueryKey, (current) => {
        const base = current ?? emptyScheduleQueryData();
        return upsertScheduleSeries(base, result.series);
      });
      void queryClient.invalidateQueries({ queryKey: meetingScheduleQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...meetingScheduleQueryKey, "detail"] });
    }
  });
}

type UpdateMeetingScheduleSeriesInput = {
  meetingId: string;
  original: ScheduledMeetingRead;
  payload: MeetingScheduleSeriesSavePayload;
};

export function useMeetingScheduleUpdateSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, original, payload }: UpdateMeetingScheduleSeriesInput) =>
      meetingsApi.updateScheduled(meetingId, mapScheduleFormToUpdatePayload(original, payload)),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<MeetingScheduleQueryData>(meetingScheduleQueryKey, (current) => {
        const base = current ?? emptyScheduleQueryData();
        return upsertScheduleSeries(base, result.series);
      });
      void queryClient.invalidateQueries({ queryKey: meetingScheduleQueryKey });
      void queryClient.invalidateQueries({
        queryKey: [...meetingScheduleQueryKey, "edit", variables.meetingId]
      });
      void queryClient.invalidateQueries({
        queryKey: [...meetingScheduleQueryKey, "detail", variables.meetingId]
      });
    }
  });
}
