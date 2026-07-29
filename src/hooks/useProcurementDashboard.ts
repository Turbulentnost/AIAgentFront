import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  omtoSupportManagerApi,
  otkHeadApi,
  procurementApi,
  purchaseManagerApi,
  productionDispatcherApi,
  productionPreparationEngineerApi,
  qualityDeputyDirectorApi,
  qualityEngineerApi,
  qualityKpiApi,
  warehouseComplexChiefApi,
  warehousePickerApi
} from "@/api/endpoints";
import type { ProcurementDashboardView } from "@/types/procurement";

const WAREHOUSE_PICKER_SLUG = "warehouse_picker_agent";
const WAREHOUSE_COMPLEX_CHIEF_SLUG = "warehouse_complex_chief_agent";

function warehouseAvailabilityApi(agentSlug: string) {
  return agentSlug === WAREHOUSE_COMPLEX_CHIEF_SLUG
    ? warehouseComplexChiefApi
    : warehousePickerApi;
}

export function useProcurementPermissions() {
  return useQuery({
    queryKey: ["procurement", "permissions"],
    queryFn: () => procurementApi.permissions(),
    staleTime: 60_000
  });
}

export function useProcurementDashboard(enabled: boolean, view: ProcurementDashboardView = "active") {
  return useQuery({
    queryKey: ["procurement", "dashboard", view],
    queryFn: () => procurementApi.getDashboard(view),
    enabled,
    refetchInterval: (query) => {
      const groups = query.state.data?.groups ?? [];
      const hasActive = groups.some((group) =>
        group.cases.some((item) =>
          ["new", "data_check", "coverage_check", "human_required", "blocked"].includes(item.status)
        )
      );
      return hasActive ? 10000 : 30000;
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
      return status &&
        ["new", "data_check", "coverage_check", "human_required", "blocked"].includes(status)
        ? 8000
        : false;
    }
  });
}

export function useProcurementCaseEvents(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "case-events", caseId],
    queryFn: () => procurementApi.listCaseEvents(caseId!),
    enabled: Boolean(caseId) && enabled
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

export function useProductionPreparationEngineerPermissions() {
  return useQuery({
    queryKey: ["procurement", "production-preparation-engineer", "permissions"],
    queryFn: () => productionPreparationEngineerApi.permissions(),
    staleTime: 60_000
  });
}

export function useProductionPreparationEngineerDashboard(
  enabled: boolean,
  view: "active" | "archive" = "active"
) {
  return useQuery({
    queryKey: ["procurement", "production-preparation-engineer", "dashboard", view],
    queryFn: () => productionPreparationEngineerApi.getDashboard(view),
    enabled,
    refetchInterval: (query) => {
      if (view === "archive") return 30000;
      const cases = query.state.data?.groups.flatMap((group) => group.cases) ?? [];
      return cases.some((item) => item.engineer_work_status === "processing") ? 10000 : 30000;
    }
  });
}

export function useProductionPreparationEngineerCase(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "production-preparation-engineer", "case", caseId],
    queryFn: () => productionPreparationEngineerApi.getCase(caseId!),
    enabled: Boolean(caseId) && enabled,
    refetchInterval: (query) =>
      query.state.data?.engineer_work_status === "processing" ? 8000 : false
  });
}

export function useProductionPreparationEngineerAction(
  action: "confirm_purchase" | "acknowledge_critical"
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) =>
      action === "confirm_purchase"
        ? productionPreparationEngineerApi.confirmPurchase(caseId)
        : productionPreparationEngineerApi.acknowledgeCritical(caseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["procurement"] });
    }
  });
}

export function useProductionDispatcherPermissions() {
  return useQuery({
    queryKey: ["procurement", "production-dispatcher", "permissions"],
    queryFn: () => productionDispatcherApi.permissions(),
    staleTime: 60_000
  });
}

export function useProductionDispatcherDashboard(
  enabled: boolean,
  view: "active" | "archive" = "active"
) {
  return useQuery({
    queryKey: ["procurement", "production-dispatcher", "dashboard", view],
    queryFn: () => productionDispatcherApi.getDashboard(view),
    enabled,
    refetchInterval: (query) => {
      if (view === "archive") return 30000;
      const cases = query.state.data?.groups.flatMap((group) => group.cases) ?? [];
      return cases.some((item) => item.dispatcher_work_status === "processing")
        ? 10000
        : 30000;
    }
  });
}

export function useProductionDispatcherCase(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "production-dispatcher", "case", caseId],
    queryFn: () => productionDispatcherApi.getCase(caseId!),
    enabled: Boolean(caseId) && enabled,
    refetchInterval: (query) =>
      query.state.data?.dispatcher_work_status === "processing" ? 8000 : false
  });
}

export function useProductionDispatcherAction(
  action: "confirm_supply" | "acknowledge_critical"
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { caseId: string; method?: string }) =>
      action === "confirm_supply"
        ? productionDispatcherApi.confirmSupply(payload.caseId, payload.method)
        : productionDispatcherApi.acknowledgeCritical(payload.caseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["procurement"] });
    }
  });
}

export function useWarehousePickerPermissions(agentSlug = WAREHOUSE_PICKER_SLUG) {
  return useQuery({
    queryKey: ["procurement", agentSlug, "permissions"],
    queryFn: () => warehouseAvailabilityApi(agentSlug).permissions(),
    staleTime: 60_000
  });
}

export function useWarehousePickerDashboard(
  enabled: boolean,
  view: "active" | "archive" = "active",
  agentSlug = WAREHOUSE_PICKER_SLUG
) {
  return useQuery({
    queryKey: ["procurement", agentSlug, "dashboard", view],
    queryFn: () => warehouseAvailabilityApi(agentSlug).getDashboard(view),
    enabled,
    refetchInterval: (query) => {
      if (view === "archive") return 30000;
      const cases = query.state.data?.groups.flatMap((group) => group.cases) ?? [];
      return cases.some((item) => item.picker_work_status === "processing")
        ? 10000
        : 30000;
    }
  });
}

export function useWarehousePickerCase(
  caseId: string | null,
  enabled: boolean,
  agentSlug = WAREHOUSE_PICKER_SLUG
) {
  return useQuery({
    queryKey: ["procurement", agentSlug, "case", caseId],
    queryFn: () => warehouseAvailabilityApi(agentSlug).getCase(caseId!),
    enabled: Boolean(caseId) && enabled,
    refetchInterval: (query) =>
      query.state.data?.picker_work_status === "processing" ? 8000 : false
  });
}

export function useWarehousePickerAction(
  action: "confirm_conclusion" | "acknowledge_critical",
  agentSlug = WAREHOUSE_PICKER_SLUG
) {
  const queryClient = useQueryClient();
  const api = warehouseAvailabilityApi(agentSlug);
  return useMutation({
    mutationFn: (payload: { caseId: string; action?: string }) =>
      action === "confirm_conclusion"
        ? api.confirmConclusion(payload.caseId, payload.action)
        : api.acknowledgeCritical(payload.caseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["procurement"] });
    }
  });
}

export function usePurchaseManagerPermissions() {
  return useQuery({
    queryKey: ["procurement", "purchase-manager", "permissions"],
    queryFn: () => purchaseManagerApi.permissions(),
    staleTime: 60_000
  });
}

export function usePurchaseManagerDashboard(
  enabled: boolean,
  view: "active" | "archive" = "active"
) {
  return useQuery({
    queryKey: ["procurement", "purchase-manager", "dashboard", view],
    queryFn: () => purchaseManagerApi.getDashboard(view),
    enabled,
    refetchInterval: (query) => {
      if (view === "archive") return 30000;
      const cases = query.state.data?.groups.flatMap((group) => group.cases) ?? [];
      return cases.some((item) => item.purchase_manager_work_status === "processing")
        ? 10000
        : 30000;
    }
  });
}

export function usePurchaseManagerCase(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "purchase-manager", "case", caseId],
    queryFn: () => purchaseManagerApi.getCase(caseId!),
    enabled: Boolean(caseId) && enabled,
    refetchInterval: (query) =>
      query.state.data?.purchase_manager_work_status === "processing" ? 8000 : false
  });
}

export function usePurchaseManagerAction(
  action: "confirm_reconciliation" | "acknowledge_critical"
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) =>
      action === "confirm_reconciliation"
        ? purchaseManagerApi.confirmReconciliation(caseId)
        : purchaseManagerApi.acknowledgeCritical(caseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["procurement"] });
    }
  });
}

export function useOmtoSupportManagerPermissions() {
  return useQuery({
    queryKey: ["procurement", "omto-support-manager", "permissions"],
    queryFn: () => omtoSupportManagerApi.permissions(),
    staleTime: 60_000
  });
}

export function useOmtoSupportManagerDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "omto-support-manager", "dashboard"],
    queryFn: () => omtoSupportManagerApi.getDashboard(),
    enabled
  });
}

export function useOmtoSupportManagerCase(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "omto-support-manager", "case", caseId],
    queryFn: () => omtoSupportManagerApi.getCase(caseId!),
    enabled: Boolean(caseId) && enabled
  });
}

export function useQualityRolePermissions(agentId: string) {
  return useQuery({
    queryKey: ["procurement", agentId, "permissions"],
    queryFn: () => procurementApi.permissions(),
    staleTime: 60_000
  });
}

export function useQualityRoleDashboard(agentId: string, enabled: boolean) {
  const api =
    agentId === "otk_head_agent"
      ? otkHeadApi
      : agentId === "quality_engineer_agent"
        ? qualityEngineerApi
        : qualityDeputyDirectorApi;
  return useQuery({
    queryKey: ["procurement", agentId, "dashboard"],
    queryFn: () => api.getDashboard(),
    enabled
  });
}

export function useQualityRoleCase(agentId: string, caseId: string | null, enabled: boolean) {
  const api =
    agentId === "otk_head_agent"
      ? otkHeadApi
      : agentId === "quality_engineer_agent"
        ? qualityEngineerApi
        : qualityDeputyDirectorApi;
  return useQuery({
    queryKey: ["procurement", agentId, "case", caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: Boolean(caseId) && enabled
  });
}

export function useQualityKpiPermissions() {
  return useQuery({
    queryKey: ["procurement", "quality-kpi", "permissions"],
    queryFn: () => qualityKpiApi.permissions(),
    staleTime: 60_000
  });
}

export function useQualityKpiDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["procurement", "quality-kpi", "dashboard"],
    queryFn: () => qualityKpiApi.getDashboard(),
    enabled
  });
}
