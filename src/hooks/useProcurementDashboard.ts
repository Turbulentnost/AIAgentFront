import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { procurementApi } from "@/api/endpoints";

export function useProcurementPermissions() {
  return useQuery({
    queryKey: ["procurement", "permissions"],
    queryFn: () => procurementApi.permissions(),
    staleTime: 60_000
  });
}

export function useProcurementDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "dashboard"],
    queryFn: () => procurementApi.getDashboard(),
    enabled,
    refetchInterval: (query) => {
      const groups = query.state.data?.groups ?? [];
      const hasActive = groups.some((group) =>
        group.cases.some((item) =>
          ["new", "data_check", "coverage_check"].includes(item.status)
        )
      );
      return hasActive ? 5000 : 30000;
    }
  });
}

export function useProcurementCase(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "case", caseId],
    queryFn: () => procurementApi.getCase(caseId!),
    enabled: Boolean(caseId) && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ["new", "data_check", "coverage_check"].includes(status) ? 4000 : false;
    }
  });
}

export function useProcurementSyncStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "sync-status"],
    queryFn: () => procurementApi.getSyncStatus(),
    enabled,
    refetchInterval: 30000
  });
}

export function useRefreshProcurementSources() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => procurementApi.refresh(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["procurement"] });
    }
  });
}
