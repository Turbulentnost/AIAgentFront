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
  FulfillmentStatusUpdatePayload,
  LineAmountsUpdatePayload,
  LineScheduleUpdatePayload,
  NonconformityPayload,
  ProcurementManagerCaseDetail,
  PurchaseOrderDraft,
  RecommendationRecord,
  RecommendationPayload,
  RfqDraft,
  ShipmentEventPayload,
  StrategyResumePayload,
  StrategyRunPayload,
  StrategyStatus,
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

export function useUpdateProcurementFulfillmentStatus() {
  return useCaseMutation<FulfillmentStatusUpdatePayload, Record<string, unknown>>(
    procurementManagerApi.updateFulfillmentStatus
  );
}

export function useUpdateProcurementLineSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId,
      lineId,
      payload
    }: {
      caseId: string;
      lineId: string;
      payload: LineScheduleUpdatePayload;
    }) => procurementManagerApi.updateLineSchedule(caseId, lineId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...rootKey, "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: [...rootKey, "case", variables.caseId] }),
        queryClient.invalidateQueries({ queryKey: [...rootKey, "all-positions"] })
      ]);
    }
  });
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

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after the browser has a chance to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function russianHttpStatusMessage(status: number | undefined): string | null {
  if (status == null) return null;
  if (status === 400) return "Некорректный запрос на выгрузку сметы.";
  if (status === 401 || status === 403) {
    return "Нет доступа к выгрузке сметы.";
  }
  if (status === 404) return "Заказ для выгрузки сметы не найден.";
  if (status >= 500) {
    return `Ошибка сервера при выгрузке сметы (код ${status}).`;
  }
  if (status >= 400) {
    return `Не удалось скачать смету (код ${status}).`;
  }
  return null;
}

async function estimateDownloadErrorMessage(error: unknown): Promise<string> {
  const axiosLike = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
    code?: string;
  };
  const status = axiosLike.response?.status;
  const data = axiosLike.response?.data;

  if (data instanceof Blob) {
    try {
      const text = (await data.text()).trim();
      if (text) {
        try {
          const parsed = JSON.parse(text) as {
            detail?: string | Array<{ msg?: string }>;
          };
          if (typeof parsed.detail === "string" && parsed.detail.trim()) {
            return parsed.detail.trim();
          }
          if (Array.isArray(parsed.detail)) {
            const messages = parsed.detail.map((item) => item?.msg).filter(Boolean);
            if (messages.length) return messages.join("; ");
          }
        } catch {
          if (!/^internal server error$/i.test(text)) {
            return text;
          }
        }
      }
    } catch {
      /* ignore blob read errors */
    }
  } else if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
  }

  const byStatus = russianHttpStatusMessage(status);
  if (byStatus) return byStatus;
  if (axiosLike.code === "ECONNABORTED") {
    return "Превышено время ожидания при скачивании сметы.";
  }
  const raw = typeof axiosLike.message === "string" ? axiosLike.message.trim() : "";
  const statusMatch = raw.match(/status code\s+(\d+)/i);
  if (statusMatch) {
    return (
      russianHttpStatusMessage(Number(statusMatch[1])) ||
      `Не удалось скачать смету (код ${statusMatch[1]}).`
    );
  }
  if (raw && !/^request failed/i.test(raw)) return raw;
  return "Не удалось скачать Excel-смету.";
}

export function useDownloadProcurementEstimate() {
  return useMutation({
    mutationFn: async (caseId: string) => {
      if (!caseId.trim()) {
        throw new Error("Не выбран заказ для выгрузки сметы");
      }
      try {
        const { blob, filename } = await procurementManagerApi.downloadEstimateReport(caseId);
        if (!blob || blob.size === 0) {
          throw new Error("Сервер вернул пустой файл сметы");
        }
        // Gateways sometimes return JSON errors with a 2xx + blob body.
        if (
          blob.type.includes("application/json") ||
          blob.type.startsWith("text/")
        ) {
          const text = await blob.text();
          let detail = text.trim() || "Не удалось скачать смету";
          try {
            const parsed = JSON.parse(text) as { detail?: string };
            if (typeof parsed.detail === "string" && parsed.detail.trim()) {
              detail = parsed.detail.trim();
            }
          } catch {
            /* keep text */
          }
          if (/^internal server error$/i.test(detail)) {
            detail = "Ошибка сервера при выгрузке сметы (код 500).";
          }
          throw new Error(detail);
        }
        triggerBrowserDownload(blob, filename);
        return filename;
      } catch (error) {
        throw new Error(await estimateDownloadErrorMessage(error));
      }
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

function invalidateStrategyQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [...rootKey, "strategy-status"] }),
    queryClient.invalidateQueries({ queryKey: [...rootKey, "dashboard"] }),
    queryClient.invalidateQueries({ queryKey: [...rootKey, "all-positions"] }),
    queryClient.invalidateQueries({ queryKey: [...rootKey, "coverage"] })
  ]);
}

export function useProcurementManagerStrategyStatus(enabled: boolean) {
  return useQuery({
    queryKey: [...rootKey, "strategy-status"],
    queryFn: () => procurementManagerApi.getStrategyStatus(),
    enabled,
    refetchInterval: (query) => (query.state.data?.paused_for_human ? 5_000 : 20_000)
  });
}

export function useRunProcurementStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: StrategyRunPayload) => procurementManagerApi.runStrategy(payload),
    onSuccess: async () => {
      await invalidateStrategyQueries(queryClient);
    }
  });
}

export function useResumeProcurementStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StrategyResumePayload) => procurementManagerApi.resumeStrategy(payload),
    onSuccess: async () => {
      await invalidateStrategyQueries(queryClient);
    }
  });
}
