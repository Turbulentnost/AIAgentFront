import { useQuery } from "@tanstack/react-query";

import {
  getMeetingScheduleDetail,
  meetingScheduleContext
} from "@/mock-data/meetingSchedule";
import type { MeetingScheduleContext, MeetingScheduleSeriesDetail } from "@/types/meetings";

const scheduleQueryKey = ["meetings", "schedule"] as const;

async function fetchMeetingSchedule(): Promise<MeetingScheduleContext> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 180);
  });

  return meetingScheduleContext;
}

async function fetchMeetingScheduleDetail(seriesId: string): Promise<MeetingScheduleSeriesDetail> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 120);
  });

  return getMeetingScheduleDetail(seriesId);
}

export function useMeetingSchedule(enabled = true) {
  return useQuery({
    queryKey: scheduleQueryKey,
    queryFn: fetchMeetingSchedule,
    enabled,
    staleTime: 30_000
  });
}

export function useMeetingScheduleDetail(seriesId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...scheduleQueryKey, "detail", seriesId],
    queryFn: () => fetchMeetingScheduleDetail(seriesId as string),
    enabled: enabled && Boolean(seriesId),
    staleTime: 30_000
  });
}
