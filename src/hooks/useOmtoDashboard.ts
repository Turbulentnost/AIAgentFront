import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { omtoApi } from "@/api/endpoints";
import type { OmtoResumeRequest, OmtoRunRequest } from "@/types/omto";

export function useOmtoPermissions() {
  return useQuery({
    queryKey: ["omto", "permissions"],
    queryFn: () => omtoApi.permissions(),
    staleTime: 60_000
  });
}

export function useOmtoDashboard(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ["omto", "dashboard", slug],
    queryFn: () => omtoApi.getDashboard(slug),
    enabled
  });
}

export function useRunOmtoAgent(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OmtoRunRequest) => omtoApi.run(slug, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["omto", "dashboard", slug] });
    }
  });
}

export function useResumeOmtoAgent(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OmtoResumeRequest) => omtoApi.resume(slug, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["omto", "dashboard", slug] });
    }
  });
}
