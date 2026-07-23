import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { procurementManagerApi } from "@/api/endpoints";
import type {
  AgentResumePayload,
  AgentRunPayload,
  AgentStatus,
  ApprovalPayload,
  ApprovalRecord,
  CaptureQuotePayload,
  CreateRfqDraftPayload,
  LineAmountsUpdatePayload,
  NonconformityPayload,
  ProcurementManagerCaseDetail,
  PurchaseOrderDraft,
  RecommendationRecord,
  RecommendationPayload,
  RfqDraft,
  ShipmentEventPayload,
  SupplierQuote,
  SupplierSearchRequest
} from "@/types/procurementManager";

const rootKey = ["procurement", "procurement-manager"] as const;

const PERMISSIONS_TIMEOUT_MS = 12_000;

export function useProcurementManagerPermissions() {
  return useQuery({
    queryKey: [...rootKey, "permissions"],
    queryFn: ({ signal }) =>
      procurementManagerApi.permissions({ signal, timeout: PERMISSIONS_TIMEOUT_MS }),
    staleTime: 60_000,
    retry: 1,
    retryDelay: 800
  });
}

export function useProcurementManagerDashboard(enabled: boolean) {
  return useQuery({
    queryKey: [...rootKey, "dashboard"],
    queryFn: procurementManagerApi.getDashboard,
    enabled,
    refetchInterval: 30_000
  });
}

export function useProcurementManagerWorkspaceSummary(enabled: boolean) {
  return useQuery({
    queryKey: [...rootKey, "workspace-summary"],
    queryFn: procurementManagerApi.getWorkspaceSummary,
    enabled,
    refetchInterval: 30_000
  });
}

export function useProcurementManagerAllPositions(enabled: boolean) {
  return useQuery({
    queryKey: [...rootKey, "all-positions"],
    queryFn: procurementManagerApi.getAllPositions,
    enabled,
    refetchInterval: 30_000
  });
}

export function useProcurementManagerSupplierOffers(
  caseId: string | null,
  nomenclature: string | null,
  needQty: number | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: [...rootKey, "supplier-offers", caseId, nomenclature, needQty],
    queryFn: () =>
      procurementManagerApi.getSupplierOffers(caseId!, {
        nomenclature: nomenclature!,
        need_qty: needQty ?? undefined,
        top_n: 3
      }),
    enabled: enabled && Boolean(caseId && nomenclature),
    staleTime: 30_000
  });
}

export function useProcurementManagerCase(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...rootKey, "case", caseId],
    queryFn: () => procurementManagerApi.getCase(caseId!),
    enabled: enabled && Boolean(caseId)
  });
}

export function useProcurementManagerCases(caseIds: string[], enabled: boolean) {
  return useQueries({
    queries: caseIds.map((id) => ({
      queryKey: [...rootKey, "case", id] as const,
      queryFn: () => procurementManagerApi.getCase(id),
      enabled: enabled && Boolean(id),
      staleTime: 30_000
    }))
  });
}

export function useProcurementManagerSuppliers(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...rootKey, "suppliers", caseId],
    queryFn: () => procurementManagerApi.getSuppliers(caseId!),
    enabled: enabled && Boolean(caseId)
  });
}

export function useProcurementManagerComparison(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...rootKey, "comparison", caseId],
    queryFn: () => procurementManagerApi.getComparison(caseId!),
    enabled: enabled && Boolean(caseId),
    retry: false
  });
}

export function useProcurementManagerOperation(operationId: string | null) {
  return useQuery({
    queryKey: [...rootKey, "operation", operationId],
    queryFn: () => procurementManagerApi.getOperation(operationId!),
    enabled: Boolean(operationId),
    refetchInterval: (query) =>
      ["executed", "rejected", "failed"].includes(query.state.data?.status ?? "") ? false : 2_000
  });
}

function useCaseMutation<TPayload, TResult>(
  mutationFn: (caseId: string, payload: TPayload) => Promise<TResult>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, payload }: { caseId: string; payload: TPayload }) =>
      mutationFn(caseId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...rootKey, "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: [...rootKey, "workspace-summary"] }),
        queryClient.invalidateQueries({ queryKey: [...rootKey, "all-positions"] }),
        queryClient.invalidateQueries({ queryKey: [...rootKey, "case", variables.caseId] }),
        queryClient.invalidateQueries({ queryKey: [...rootKey, "suppliers", variables.caseId] }),
        queryClient.invalidateQueries({ queryKey: [...rootKey, "comparison", variables.caseId] })
      ]);
    }
  });
}

export function useSearchProcurementSuppliers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, payload }: { caseId: string; payload?: SupplierSearchRequest }) =>
      procurementManagerApi.searchSuppliers(caseId, payload),
    onSuccess: async (_data, { caseId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...rootKey, "case", caseId] }),
        queryClient.invalidateQueries({ queryKey: [...rootKey, "suppliers", caseId] })
      ]);
    }
  });
}

export function useCreateProcurementRfqDraft() {
  return useCaseMutation<CreateRfqDraftPayload, RfqDraft>(procurementManagerApi.createRfqDraft);
}

export function useCaptureProcurementQuote() {
  return useCaseMutation<CaptureQuotePayload, SupplierQuote>(procurementManagerApi.captureQuote);
}

export function useCreateProcurementRecommendation() {
  return useCaseMutation<RecommendationPayload, RecommendationRecord>(
    procurementManagerApi.createRecommendation
  );
}

export function useSubmitProcurementApproval() {
  return useCaseMutation<ApprovalPayload, ApprovalRecord>(procurementManagerApi.submitApproval);
}

export function useAddProcurementShipmentEvent() {
  return useCaseMutation<ShipmentEventPayload, Record<string, unknown>>(
    procurementManagerApi.addShipmentEvent
  );
}

export function useReportProcurementNonconformity() {
  return useCaseMutation<NonconformityPayload, Record<string, unknown>>(
    procurementManagerApi.reportNonconformity
  );
}

export function useUpdateProcurementLineAmounts() {
  return useCaseMutation<
    LineAmountsUpdatePayload,
    { line_amounts: Record<string, LineAmountsUpdatePayload["lines"][number]> }
  >(procurementManagerApi.updateLineAmounts);
}

export function useSyncProcurementFrom1C() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => procurementManagerApi.syncFrom1C(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rootKey });
    }
  });
}

export function useDownloadProcurementEstimate() {
  return useMutation({
    mutationFn: async (caseId: string) => {
      const { blob, filename } = await procurementManagerApi.downloadEstimateReport(caseId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return filename;
    }
  });
}

export function useProcurementManagerAgentStatus(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...rootKey, "agent-status", caseId],
    queryFn: () => procurementManagerApi.getAgentStatus(caseId!),
    enabled: enabled && Boolean(caseId),
    refetchInterval: (query) => (query.state.data?.paused_for_human ? 5_000 : 15_000)
  });
}

export function useProcurementManagerPurchaseOrderDrafts(
  caseId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: [...rootKey, "purchase-order-drafts", caseId],
    queryFn: () => procurementManagerApi.listPurchaseOrderDrafts(caseId!),
    enabled: enabled && Boolean(caseId)
  });
}

function invalidateAgentQueries(queryClient: ReturnType<typeof useQueryClient>, caseId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [...rootKey, "dashboard"] }),
    queryClient.invalidateQueries({ queryKey: [...rootKey, "case", caseId] }),
    queryClient.invalidateQueries({ queryKey: [...rootKey, "agent-status", caseId] }),
    queryClient.invalidateQueries({ queryKey: [...rootKey, "suppliers", caseId] }),
    queryClient.invalidateQueries({ queryKey: [...rootKey, "comparison", caseId] }),
    queryClient.invalidateQueries({
      queryKey: [...rootKey, "purchase-order-drafts", caseId]
    })
  ]);
}

export function useRunProcurementAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, payload }: { caseId: string; payload?: AgentRunPayload }) =>
      procurementManagerApi.runAgent(caseId, payload),
    onSuccess: async (_data, { caseId }) => {
      await invalidateAgentQueries(queryClient, caseId);
    }
  });
}

export function useResumeProcurementAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, payload }: { caseId: string; payload: AgentResumePayload }) =>
      procurementManagerApi.resumeAgent(caseId, payload),
    onSuccess: async (_data, { caseId }) => {
      await invalidateAgentQueries(queryClient, caseId);
    }
  });
}
