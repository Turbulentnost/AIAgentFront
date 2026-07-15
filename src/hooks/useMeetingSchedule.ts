import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { meetingsApi } from "@/api/endpoints";
import type { MeetingScheduleContext, MeetingScheduleSeriesSavePayload } from "@/types/meetings";
import {
  incrementMeetingScheduleTypeCounts,
  mapScheduleFormToApiPayload,
  mapScheduledMeetingReadToSeriesItem,
  mapScheduledMeetingsToContext
} from "@/utils/meetingScheduleApi";

export const meetingScheduleQueryKey = ["meetings", "schedule"] as const;

const emptyScheduleContext = (): MeetingScheduleContext => ({
  type_counts: { total: 0, planned: 0, report: 0, selector: 0, unplanned: 0 },
  items: [],
  fetched_at: new Date().toISOString()
});

async function fetchMeetingSchedule(): Promise<MeetingScheduleContext> {
  try {
    const items = await meetingsApi.getSchedule();
    return mapScheduledMeetingsToContext(items);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return emptyScheduleContext();
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
    }
  });
}

export function useMeetingScheduleDetail(seriesId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...meetingScheduleQueryKey, "detail", seriesId],
    queryFn: () => meetingsApi.getScheduleDetail(seriesId as string),
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

export function useMeetingScheduleCreateSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MeetingScheduleSeriesSavePayload) => {
      const apiPayload = mapScheduleFormToApiPayload(payload);
      return meetingsApi.createScheduled(apiPayload);
    },
    onSuccess: (read) => {
      const item = mapScheduledMeetingReadToSeriesItem(read);

      queryClient.setQueryData<MeetingScheduleContext>(meetingScheduleQueryKey, (current) => {
        const base = current ?? emptyScheduleContext();
        const hasItem = base.items.some((existing) => existing.id === item.id);

        return {
          ...base,
          fetched_at: new Date().toISOString(),
          items: hasItem ? base.items : [...base.items, item],
          type_counts: hasItem
            ? base.type_counts
            : incrementMeetingScheduleTypeCounts(base.type_counts, item.type)
        };
      });

      void queryClient.invalidateQueries({ queryKey: meetingScheduleQueryKey });
    }
  });
}
