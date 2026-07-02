import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { meetingsApi } from "@/api/endpoints";
import type { MeetingRegistryStageFilter } from "@/types/meetings";
import { registryStageQueryParam } from "@/utils/meetingRegistry";

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
