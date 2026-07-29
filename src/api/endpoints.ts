import { apiClient, longRunningApiClient } from "./client";
import { pochtaApiClient } from "./pochtaClient";
import type {
  Agent,
  AgentAccess,
  AgentAccessManagement,
  AgentDepartmentGrantInput,
  AgentUserGrantInput,
  BrowserRun,
  BrowserRunResult,
  ChunkSearchHit,
  ChunkSearchQuery,
  Department,
  DepartmentCreate,
  DepartmentSyncStatus,
  EmployeeSyncResult,
  Document,
  DocumentChunk,
  DocumentListItem,
  DocumentUploadOptions,
  Page,
  EmailMessage,
  EmailMessageActionResponse,
  EmailMessageFetchBodyResponse,
  EmailMessagesPage,
  EmailMessagesStats,
  PochtaDepartment,
  PochtaOrganization,
  PochtaContractor,
  HealthResponse,
  Position,
  KnowledgeBase,
  KnowledgeBaseAccessExceptionInput,
  KnowledgeBaseListItem,
  KnowledgeBaseAccessGrantInput,
  KnowledgeBaseAgentBinding,
  KnowledgeBaseAgentBindingInput,
  KnowledgeBaseChunk,
  KnowledgeBaseCreate,
  KnowledgeBaseIndexJobType,
  KnowledgeBaseIndexingError,
  KnowledgeBaseIndexingJob,
  KnowledgeBaseOverviewStats,
  KnowledgeBaseReadiness,
  KnowledgeBaseRule,
  KnowledgeBaseSource,
  KnowledgeBaseStats,
  KnowledgeBaseStatus,
  KnowledgeBaseSearchQuery,
  KnowledgeBaseTestSearchResponse,
  LoginPayload,
  OneCLoginResponse,
  OneCSession,
  NdChangeCandidateDocument,
  NdChangePreview,
  NdChangeRequest,
  NdChangeRequestCreate,
  NdChangeTargetLocation,
  NdControlDepartment,
  NdControlDepartmentCreate,
  NdControlDepartmentCreateResponse,
  NdChangeJournalEntry,
  NdChangeJournalParams,
  NdControlPermissions,
  NdControlTemplate,
  NdControlTemplateCreate,
  NdControlTemplateDetail,
  NdControlTemplateDocument,
  NdControlTemplateDocumentCreate,
  NdControlTemplateDocumentUpdate,
  NdControlTemplateKnowledgeBasesUpdate,
  NdControlTemplateSource,
  NdControlTemplateUpdate,
  NdTemplateType,
  NdTemplateTypeOption,
  DepartmentAnalysisRun,
  DepartmentAnalysisRunListItem,
  DepartmentAnalysisStatus,
  DepartmentProcessItem,
  DepartmentRelationItem,
  DepartmentReviewPending,
  DepartmentStructuralDocumentCard,
  DepartmentSummary,
  ProcessUmlResponse,
  NdDocumentCard,
  NdDocumentCardUpdate,
  Role,
  Task,
  TaskCreate,
  TaskResult,
  TaskStep,
  TokenResponse,
  ResponsibleUser,
  User,
  UserCreate,
  UserUpdate,
  MeetingLoginContext,
  MeetingMemoDetail,
  MeetingMemoSeriesCreateRead,
  MeetingMemoSeriesCreateRequest,
  MeetingMemoSeriesPlanningChoiceRead,
  MeetingMemoSeriesPlanningChoiceRequest,
  MeetingPermissions,
  MeetingRun,
  MeetingRunCreate,
  MeetingRunResult,
  MeetingAgentSlotPreview,
  MeetingAgentSlotPreviewRequest,
  MeetingAgentSlotPreviewDetails,
  MeetingAgentSlotPreviewDetailsRequest,
  MeetingAgentSlotApprove,
  MeetingAgentSlotApproveRequest,
  MeetingMemoRejectRead,
  MeetingMemoRejectRequest,
  MeetingMemoApproveRead,
  MeetingMemoApproveRequest,
  MeetingRegistryContext,
  MeetingRegistryCancelRequest,
  MeetingRegistryCancelResponse,
  MeetingRegistryProtocolCreateResponse,
  MeetingRegistryParticipantsResponse,
  MeetingRegistryParticipantSearchResponse,
  MeetingRegistryParticipantsApplyRequest,
  MeetingRegistryParticipantsApplyResponse,
  MeetingRegistryParticipantsAddConfirmRequest,
  MeetingRegistryParticipantsAddConfirmResponse,
  MeetingRegistryParticipantsRemovalConfirmRequest,
  MeetingRegistryParticipantsRemovalConfirmResponse,
  MeetingRegistryRescheduleSlotPreviewRequest,
  MeetingRegistryRescheduleSlotPreviewResponse,
  MeetingRegistryRescheduleApproveRequest,
  MeetingRegistryRescheduleApproveResponse,
  MeetingScheduleSeriesItem,
  MeetingScheduleSeriesSavePayload,
  MeetingCategoryRead,
  ScheduledMeetingCancelRead,
  ScheduledMeetingCancelRequest,
  ScheduledMeetingCreate,
  ScheduledMeetingDetailRead,
  ScheduledMeetingEmployeeOption,
  ScheduledMeetingPositionResolveRead,
  ScheduledMeetingParticipantOption,
  ScheduledMeetingPlanPreviewRead,
  ScheduledMeetingPlanPreviewRequest,
  ScheduledMeetingPlanRequest,
  ScheduledMeetingRead,
  ScheduledMeetingUpdate,
  ScheduledMeetingUpdateRead,
  MeetingTopicCheckSimilarRead,
  MeetingTopicCheckSimilarRequest,
  MeetingTopicResolveRead,
  MeetingTopicResolveRequest,
  MeetingTopicValidationRead,
  MeetingSlot,
  MeetingSlotsRequest,
  PorucheniyaDashboardParams,
  PorucheniyaDashboardRefreshPayload,
  PorucheniyaPermissions,
  TasksDashboardRead,
  AgentBlueprint,
  AgentBuilderSession,
  AgentBuilderSessionDetail,
  AgentBuilderPlan,
  AgentBuilderAttempt,
  AgentBuilderToolCatalogItem,
  SandboxRun
} from "@/types";
import type {
  ProcurementCaseDetail,
  ProcurementCaseEvent,
  ProcurementDashboard,
  ProcurementPermissions,
  ProductionPreparationEngineerCaseDetail,
  ProductionPreparationEngineerAction,
  ProductionPreparationEngineerDashboard,
  ProductionDispatcherAction,
  ProductionDispatcherCaseDetail,
  ProductionDispatcherDashboard,
  PurchaseManagerAction,
  PurchaseManagerCaseDetail,
  PurchaseManagerDashboard,
  WarehousePickerAction,
  WarehousePickerCaseDetail,
  WarehousePickerDashboard,
  OmtoSupportManagerCaseDetail,
  OmtoSupportManagerDashboard,
  QualityKpiReport,
  QualityRoleCaseDetail,
  QualityRoleDashboard,
  ProcurementRefreshResult,
  ProcurementRoleAgentResult,
  ProcurementRoleAgentResume,
  ProcurementSyncStatus
} from "@/types/procurement";

import type {
  AgentResumePayload,
  AgentRunPayload,
  AgentStatus,
  AllPositionsResponse,
  ApprovalPayload,
  ApprovalRecord,
  CaptureQuotePayload,
  ComparisonWeights,
  CreateRfqDraftPayload,
  FulfillmentStatusUpdatePayload,
  LineAmountsUpdatePayload,
  LineScheduleUpdatePayload,
  MaterialAllocationResult,
  MaterialBankResponse,
  NonconformityPayload,
  OperationStatus,
  ProcurementManagerCaseDetail,
  ProcurementManagerDashboard,
  ProcurementManagerWorkspaceSummary,
  ProcurementSyncFrom1CResult,
  PurchaseOrderDraft,
  QuoteComparison,
  RecommendationPayload,
  RecommendationRecord,
  RfqDraft,
  ShipmentEventPayload,
  StrategyResumePayload,
  StrategyRunPayload,
  StrategyStatus,
  Supplier,
  SupplierOffersResponse,
  SupplierQuote,
  SupplierSearchRequest,
  SupplierSearchResult
} from "@/types/procurementManager";
import type {
  OtkPresentationCardApi,
  OtkPresentationListApi,
  OtkPresentationUpdateApi,
  OtkShipmentLineCreateApi,
  OtkShipmentLineUpdateApi,
  OtkWriteTo1CResultApi
} from "@/types/otk";
import type {
  AppNotification,
  AppNotificationAccept,
  AppNotificationAcceptRequest,
  AppNotificationList,
  AppNotificationOpen
} from "@/types/notifications";

export const notificationsApi = {
  list: () => apiClient.get<AppNotificationList>("/notifications").then((r) => r.data),
  markRead: (notificationId: string) =>
    apiClient.post<AppNotification>(`/notifications/${notificationId}/read`).then((r) => r.data),
  open: (notificationId: string) =>
    longRunningApiClient
      .post<AppNotificationOpen>(`/notifications/${notificationId}/open`)
      .then((r) => r.data),
  accept: (notificationId: string, payload?: AppNotificationAcceptRequest) =>
    apiClient
      .post<AppNotificationAccept>(`/notifications/${notificationId}/accept`, payload ?? {})
      .then((r) => r.data),
  dismiss: (notificationId: string) =>
    apiClient.post<AppNotification>(`/notifications/${notificationId}/dismiss`).then((r) => r.data)
};

export const meetingsApi = {
  permissions: () => apiClient.get<MeetingPermissions>("/meetings/me/permissions").then((r) => r.data),
  getDashboard: () =>
    longRunningApiClient
      .get<MeetingLoginContext>("/meetings/dashboard", {
        params: { _: Date.now() },
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  refreshDashboard: () =>
    longRunningApiClient.post<MeetingLoginContext>("/meetings/dashboard/refresh").then((r) => r.data),
  getRegistry: (stage?: string) =>
    apiClient
      .get<MeetingRegistryContext>("/meetings/registry", {
        params: stage ? { stage } : undefined,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  saveRegistryMeetingTopic: (memoRefKey: string, payload: MeetingTopicResolveRead) =>
    apiClient
      .post(`/meetings/registry/${memoRefKey}/meeting-topic`, payload)
      .then((r) => r.data),
  dispatchProtocolDrafts: () =>
    apiClient.post("/meetings/registry/dispatch-protocol-drafts").then((r) => r.data),
  createRegistryProtocol: (memoRefKey: string) =>
    longRunningApiClient
      .post<MeetingRegistryProtocolCreateResponse>(`/meetings/registry/${memoRefKey}/create-protocol`)
      .then((r) => r.data),
  getRegistryParticipants: (memoRefKey: string) =>
    longRunningApiClient
      .get<MeetingRegistryParticipantsResponse>(`/meetings/registry/${memoRefKey}/participants`)
      .then((r) => r.data),
  searchRegistryParticipants: (
    memoRefKey: string,
    fio: string,
    options?: { signal?: AbortSignal }
  ) =>
    longRunningApiClient
      .get<MeetingRegistryParticipantSearchResponse>(
        `/meetings/registry/${memoRefKey}/participants/search`,
        { params: { fio }, signal: options?.signal }
      )
      .then((r) => r.data),
  applyRegistryParticipants: (memoRefKey: string, payload: MeetingRegistryParticipantsApplyRequest) =>
    longRunningApiClient
      .post<MeetingRegistryParticipantsApplyResponse>(
        `/meetings/registry/${memoRefKey}/participants/apply`,
        payload
      )
      .then((r) => r.data),
  confirmRegistryParticipantsAdd: (
    memoRefKey: string,
    payload: MeetingRegistryParticipantsAddConfirmRequest
  ) =>
    longRunningApiClient
      .post<MeetingRegistryParticipantsAddConfirmResponse>(
        `/meetings/registry/${memoRefKey}/participants/confirm-add`,
        payload
      )
      .then((r) => r.data),
  confirmRegistryParticipantsRemoval: (
    memoRefKey: string,
    payload: MeetingRegistryParticipantsRemovalConfirmRequest
  ) =>
    longRunningApiClient
      .post<MeetingRegistryParticipantsRemovalConfirmResponse>(
        `/meetings/registry/${memoRefKey}/participants/confirm-removal`,
        payload
      )
      .then((r) => r.data),
  cancelRegistryParticipantsRemoval: (memoRefKey: string) =>
    longRunningApiClient
      .post<MeetingRegistryParticipantsResponse>(
        `/meetings/registry/${memoRefKey}/participants/cancel-removal`
      )
      .then((r) => r.data),
  cancelRegistryMeeting: (memoRefKey: string, payload?: MeetingRegistryCancelRequest) =>
    longRunningApiClient
      .post<MeetingRegistryCancelResponse>(`/meetings/registry/${memoRefKey}/cancel`, payload ?? {})
      .then((r) => r.data),
  rescheduleSlotPreview: (
    memoRefKey: string,
    payload?: MeetingRegistryRescheduleSlotPreviewRequest,
    options?: { signal?: AbortSignal }
  ) =>
    longRunningApiClient
      .post<MeetingRegistryRescheduleSlotPreviewResponse>(
        `/meetings/registry/${memoRefKey}/reschedule/slot-preview`,
        payload ?? {},
        { signal: options?.signal }
      )
      .then((r) => r.data),
  approveRegistryReschedule: (
    memoRefKey: string,
    payload: MeetingRegistryRescheduleApproveRequest
  ) =>
    longRunningApiClient
      .post<MeetingRegistryRescheduleApproveResponse>(
        `/meetings/registry/${memoRefKey}/reschedule/approve`,
        payload
      )
      .then((r) => r.data),
  getMemoDetail: (memoRefKey: string, options?: { forceRefresh?: boolean }) =>
    apiClient
      .get<MeetingMemoDetail>(`/meetings/memos/${memoRefKey}/detail`, {
        params: options?.forceRefresh ? { force_refresh: true } : undefined
      })
      .then((r) => r.data),
  saveSeriesPlanningChoice: (
    memoRefKey: string,
    payload: MeetingMemoSeriesPlanningChoiceRequest
  ) =>
    apiClient
      .post<MeetingMemoSeriesPlanningChoiceRead>(
        `/meetings/memos/${memoRefKey}/series-planning-choice`,
        payload
      )
      .then((r) => r.data),
  createSeriesFromMemo: (
    memoRefKey: string,
    payload?: MeetingMemoSeriesCreateRequest
  ) =>
    apiClient
      .post<MeetingMemoSeriesCreateRead>(`/meetings/memos/${memoRefKey}/create-series`, payload ?? {})
      .then((r) => r.data),
  findSlots: (payload: MeetingSlotsRequest) =>
    apiClient.post<MeetingSlot[]>("/meetings/slots", payload).then((r) => r.data),
  slotPreview: (
    memoRefKey: string,
    payload?: MeetingAgentSlotPreviewRequest,
    options?: { signal?: AbortSignal }
  ) =>
    longRunningApiClient
      .post<MeetingAgentSlotPreview>(
        `/meetings/memos/${memoRefKey}/agent/slot-preview`,
        payload ?? {},
        { signal: options?.signal }
      )
      .then((r) => r.data),
  slotPreviewDetails: (
    memoRefKey: string,
    payload: MeetingAgentSlotPreviewDetailsRequest,
    options?: { signal?: AbortSignal }
  ) =>
    longRunningApiClient
      .post<MeetingAgentSlotPreviewDetails>(
        `/meetings/memos/${memoRefKey}/agent/slot-preview/details`,
        payload,
        { signal: options?.signal }
      )
      .then((r) => r.data),
  approveSlot: (memoRefKey: string, payload: MeetingAgentSlotApproveRequest) =>
    longRunningApiClient
      .post<MeetingAgentSlotApprove>(`/meetings/memos/${memoRefKey}/agent/approve`, payload)
      .then((r) => r.data),
  rejectMemo: (memoRefKey: string, payload: MeetingMemoRejectRequest) =>
    longRunningApiClient
      .post<MeetingMemoRejectRead>(`/meetings/memos/${memoRefKey}/reject`, payload)
      .then((r) => r.data),
  approveMemo: (memoRefKey: string, payload?: MeetingMemoApproveRequest) =>
    longRunningApiClient
      .post<MeetingMemoApproveRead>(`/meetings/memos/${memoRefKey}/approve`, payload ?? {})
      .then((r) => r.data),
  createRun: (payload: MeetingRunCreate) =>
    apiClient.post<MeetingRun>("/meetings/runs", payload).then((r) => r.data),
  getRun: (taskId: string) => apiClient.get<MeetingRunResult>(`/meetings/runs/${taskId}`).then((r) => r.data),
  getSchedule: () =>
    apiClient
      .get<ScheduledMeetingRead[]>("/meetings/scheduled", {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  listScheduleEmployeeOptions: (search?: string) =>
    apiClient
      .get<ScheduledMeetingEmployeeOption[]>("/meetings/scheduled/employee-options", {
        params: search?.trim() ? { search: search.trim() } : undefined,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  resolveSchedulePositions: (positionIds: string[]) =>
    apiClient
      .post<ScheduledMeetingPositionResolveRead>("/meetings/scheduled/resolve-positions", {
        position_ids: positionIds
      })
      .then((r) => r.data),
  listScheduleParticipantOptions: (search?: string) =>
    apiClient
      .get<ScheduledMeetingParticipantOption[]>("/meetings/scheduled/participant-options", {
        params: search?.trim() ? { search: search.trim() } : undefined,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  listScheduleCategoryOptions: () =>
    apiClient
      .get<MeetingCategoryRead[]>("/meetings/scheduled/category-options", {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  getScheduled: (meetingId: string) =>
    apiClient
      .get<ScheduledMeetingRead>(`/meetings/scheduled/${meetingId}`, {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  getScheduledDetail: (meetingId: string) =>
    apiClient
      .get<ScheduledMeetingDetailRead>(`/meetings/scheduled/${meetingId}/detail`, {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  createScheduled: (payload: ScheduledMeetingCreate) =>
    apiClient.post<ScheduledMeetingRead>("/meetings/scheduled", payload).then((r) => r.data),
  updateScheduled: (meetingId: string, payload: ScheduledMeetingUpdate) =>
    longRunningApiClient
      .patch<ScheduledMeetingUpdateRead>(`/meetings/scheduled/${meetingId}`, payload)
      .then((r) => r.data),
  planPreviewScheduled: (
    meetingId: string,
    payload?: ScheduledMeetingPlanPreviewRequest
  ) =>
    longRunningApiClient
      .post<ScheduledMeetingPlanPreviewRead>(
        `/meetings/scheduled/${meetingId}/plan-preview`,
        payload ?? { conflict_policy: "soft_week" }
      )
      .then((r) => r.data),
  planScheduled: (meetingId: string, payload?: ScheduledMeetingPlanRequest) =>
    longRunningApiClient
      .post<ScheduledMeetingRead>(
        `/meetings/scheduled/${meetingId}/plan`,
        payload ?? {}
      )
      .then((r) => r.data),
  cancelScheduled: (meetingId: string, payload?: ScheduledMeetingCancelRequest) =>
    longRunningApiClient
      .post<ScheduledMeetingCancelRead>(`/meetings/scheduled/${meetingId}/cancel`, payload ?? {})
      .then((r) => r.data),
  checkSimilarTopic: (
    payload: MeetingTopicCheckSimilarRequest,
    options?: { signal?: AbortSignal }
  ) =>
    longRunningApiClient
      .post<MeetingTopicCheckSimilarRead>("/meetings/topics/check-similar", payload, {
        signal: options?.signal
      })
      .then((r) => r.data),
  resolveTopic: (
    payload: MeetingTopicResolveRequest,
    options?: { signal?: AbortSignal }
  ) =>
    longRunningApiClient
      .post<MeetingTopicResolveRead>("/meetings/topics/resolve", payload, {
        signal: options?.signal
      })
      .then((r) => r.data),
  validateTopicRef: (topicRefKey: string) =>
    apiClient
      .get<MeetingTopicValidationRead>(`/meetings/topics/${topicRefKey}/validate`)
      .then((r) => r.data)
};

export const porucheniyaApi = {
  permissions: () =>
    apiClient.get<PorucheniyaPermissions>("/porucheniya/me/permissions").then((r) => r.data),
  getDashboard: (params?: PorucheniyaDashboardParams) =>
    longRunningApiClient
      .get<TasksDashboardRead>("/porucheniya/dashboard", {
        params,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
      .then((r) => r.data),
  refreshDashboard: (payload?: PorucheniyaDashboardRefreshPayload) =>
    longRunningApiClient
      .post<TasksDashboardRead>("/porucheniya/dashboard/refresh", payload ?? {})
      .then((r) => r.data)
};

export const procurementApi = {
  permissions: () =>
    apiClient.get<ProcurementPermissions>("/procurement/me/permissions").then((r) => r.data),
  getDashboard: (view: "active" | "processing" | "archive" = "active") =>
    apiClient
      .get<ProcurementDashboard>("/procurement/dashboard", { params: { view } })
      .then((r) => r.data),
  getCase: (caseId: string) =>
    apiClient.get<ProcurementCaseDetail>(`/procurement/cases/${caseId}`).then((r) => r.data),
  listCaseEvents: (caseId: string) =>
    apiClient.get<ProcurementCaseEvent[]>(`/procurement/cases/${caseId}/events`).then((r) => r.data),
  submitRoleAgentResult: (caseId: string, payload: ProcurementRoleAgentResume) =>
    apiClient
      .post<ProcurementRoleAgentResult>(`/procurement/cases/${caseId}/agent-result`, payload)
      .then((r) => r.data),
  getSyncStatus: () =>
    apiClient.get<ProcurementSyncStatus[]>("/procurement/sync-status").then((r) => r.data),
  refresh: () =>
    apiClient.post<ProcurementRefreshResult>("/procurement/refresh").then((r) => r.data)
};

export const productionPreparationEngineerApi = {
  permissions: () =>
    apiClient.get<ProcurementPermissions>("/procurement/me/permissions").then((r) => r.data),
  getDashboard: (view: "active" | "archive" = "active") =>
    apiClient
      .get<ProductionPreparationEngineerDashboard>(
        "/procurement/role-agents/production_preparation_engineer_agent/dashboard",
        { params: { view } }
      )
      .then((r) => r.data),
  getCase: (caseId: string) =>
    apiClient
      .get<ProductionPreparationEngineerCaseDetail>(
        `/procurement/role-agents/production_preparation_engineer_agent/cases/${caseId}`
      )
      .then((r) => r.data),
  confirmPurchase: (caseId: string) =>
    apiClient
      .post<ProductionPreparationEngineerAction>(
        `/procurement/role-agents/production_preparation_engineer_agent/cases/${caseId}/confirm-purchase`
      )
      .then((r) => r.data),
  acknowledgeCritical: (caseId: string) =>
    apiClient
      .post<ProductionPreparationEngineerAction>(
        `/procurement/role-agents/production_preparation_engineer_agent/cases/${caseId}/acknowledge-critical`
      )
      .then((r) => r.data)
};

export const productionDispatcherApi = {
  permissions: () =>
    apiClient.get<ProcurementPermissions>("/procurement/me/permissions").then((r) => r.data),
  getDashboard: (view: "active" | "archive" = "active") =>
    apiClient
      .get<ProductionDispatcherDashboard>(
        "/procurement/role-agents/production_dispatcher_agent/dashboard",
        { params: { view } }
      )
      .then((r) => r.data),
  getCase: (caseId: string) =>
    apiClient
      .get<ProductionDispatcherCaseDetail>(
        `/procurement/role-agents/production_dispatcher_agent/cases/${caseId}`
      )
      .then((r) => r.data),
  confirmSupply: (caseId: string, method?: string) =>
    apiClient
      .post<ProductionDispatcherAction>(
        `/procurement/role-agents/production_dispatcher_agent/cases/${caseId}/confirm-supply`,
        null,
        { params: method ? { method } : undefined }
      )
      .then((r) => r.data),
  acknowledgeCritical: (caseId: string) =>
    apiClient
      .post<ProductionDispatcherAction>(
        `/procurement/role-agents/production_dispatcher_agent/cases/${caseId}/acknowledge-critical`
      )
      .then((r) => r.data)
};

function createWarehouseAvailabilityApi(agentSlug: string) {
  return {
    permissions: () =>
      apiClient.get<ProcurementPermissions>("/procurement/me/permissions").then((r) => r.data),
    getDashboard: (view: "active" | "archive" = "active") =>
      apiClient
        .get<WarehousePickerDashboard>(
          `/procurement/role-agents/${agentSlug}/dashboard`,
          { params: { view } }
        )
        .then((r) => r.data),
    getCase: (caseId: string) =>
      apiClient
        .get<WarehousePickerCaseDetail>(
          `/procurement/role-agents/${agentSlug}/cases/${caseId}`
        )
        .then((r) => r.data),
    confirmConclusion: (caseId: string, action?: string) =>
      apiClient
        .post<WarehousePickerAction>(
          `/procurement/role-agents/${agentSlug}/cases/${caseId}/confirm-conclusion`,
          null,
          { params: action ? { action } : undefined }
        )
        .then((r) => r.data),
    acknowledgeCritical: (caseId: string) =>
      apiClient
        .post<WarehousePickerAction>(
          `/procurement/role-agents/${agentSlug}/cases/${caseId}/acknowledge-critical`
        )
        .then((r) => r.data)
  };
}

export const warehousePickerApi = createWarehouseAvailabilityApi("warehouse_picker_agent");
export const warehouseComplexChiefApi = createWarehouseAvailabilityApi(
  "warehouse_complex_chief_agent"
);

export const purchaseManagerApi = {
  permissions: () =>
    apiClient.get<ProcurementPermissions>("/procurement/me/permissions").then((r) => r.data),
  getDashboard: (view: "active" | "archive" = "active") =>
    apiClient
      .get<PurchaseManagerDashboard>(
        "/procurement/role-agents/purchase_manager_agent/dashboard",
        { params: { view } }
      )
      .then((r) => r.data),
  getCase: (caseId: string) =>
    apiClient
      .get<PurchaseManagerCaseDetail>(
        `/procurement/role-agents/purchase_manager_agent/cases/${caseId}`
      )
      .then((r) => r.data),
  confirmReconciliation: (caseId: string) =>
    apiClient
      .post<PurchaseManagerAction>(
        `/procurement/role-agents/purchase_manager_agent/cases/${caseId}/confirm-reconciliation`
      )
      .then((r) => r.data),
  acknowledgeCritical: (caseId: string) =>
    apiClient
      .post<PurchaseManagerAction>(
        `/procurement/role-agents/purchase_manager_agent/cases/${caseId}/acknowledge-critical`
      )
      .then((r) => r.data)
};

const PROCUREMENT_MANAGER_BASE =
  "/procurement/role-agents/purchase_manager_agent";

export const procurementManagerApi = {
  permissions: (config?: { signal?: AbortSignal; timeout?: number }) =>
    apiClient
      .get<ProcurementPermissions>("/procurement/me/permissions", {
        signal: config?.signal,
        timeout: config?.timeout ?? 12_000
      })
      .then((r) => r.data),
  getDashboard: (config?: { signal?: AbortSignal; timeout?: number }) =>
    apiClient
      .get<ProcurementManagerDashboard>(`${PROCUREMENT_MANAGER_BASE}/dashboard`, {
        signal: config?.signal,
        timeout: config?.timeout ?? 20_000
      })
      .then((r) => r.data),
  getWorkspaceSummary: (config?: { signal?: AbortSignal; timeout?: number }) =>
    apiClient
      .get<ProcurementManagerWorkspaceSummary>(
        `${PROCUREMENT_MANAGER_BASE}/workspace-summary`,
        {
          signal: config?.signal,
          timeout: config?.timeout ?? 15_000
        }
      )
      .then((r) => r.data),
  getMaterialBank: () =>
    apiClient
      .get<MaterialBankResponse>(`${PROCUREMENT_MANAGER_BASE}/material-bank`)
      .then((r) => r.data),
  getCoverage: () =>
    apiClient
      .get<MaterialAllocationResult>(`${PROCUREMENT_MANAGER_BASE}/coverage`)
      .then((r) => r.data),
  getAllPositions: (config?: { signal?: AbortSignal; timeout?: number }) =>
    apiClient
      .get<AllPositionsResponse>(`${PROCUREMENT_MANAGER_BASE}/all-positions`, {
        signal: config?.signal,
        timeout: config?.timeout ?? 25_000
      })
      .then((r) => r.data),
  getSupplierOffers: (
    caseId: string,
    params: { nomenclature: string; need_qty?: number; top_n?: number }
  ) =>
    apiClient
      .get<SupplierOffersResponse>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/supplier-offers`,
        { params }
      )
      .then((r) => r.data),
  getCase: (caseId: string, config?: { signal?: AbortSignal; timeout?: number }) =>
    apiClient
      .get<ProcurementManagerCaseDetail>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}`,
        {
          signal: config?.signal,
          timeout: config?.timeout ?? 20_000
        }
      )
      .then((r) => r.data),
  updateLineAmounts: (caseId: string, payload: LineAmountsUpdatePayload) =>
    apiClient
      .put<{ line_amounts: Record<string, LineAmountsUpdatePayload["lines"][number]> }>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/line-amounts`,
        payload
      )
      .then((r) => r.data),
  createOtkPresentation: (caseId: string) =>
    apiClient
      .post<{ presentation_id: string }>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/otk-presentation`
      )
      .then((r) => r.data),
  updateFulfillmentStatus: (caseId: string, payload: FulfillmentStatusUpdatePayload) =>
    apiClient
      .patch(`${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/fulfillment-status`, payload)
      .then((r) => r.data),
  updateLineSchedule: (
    caseId: string,
    lineId: string,
    payload: LineScheduleUpdatePayload
  ) =>
    apiClient
      .patch(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/lines/${encodeURIComponent(lineId)}/schedule`,
        payload
      )
      .then((r) => r.data),
  downloadEstimateReport: (caseId: string) =>
    apiClient
      .get<Blob>(`${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/estimate-report`, {
        responseType: "blob"
      })
      .then((response) => ({
        blob: response.data,
        filename: parseContentDispositionFilename(
          response.headers["content-disposition"],
          `estimate_${caseId}.xlsx`
        )
      })),
  syncFrom1C: () =>
    longRunningApiClient
      .post<ProcurementSyncFrom1CResult>(`${PROCUREMENT_MANAGER_BASE}/sync-from-1c`)
      .then((r) => r.data),
  searchSuppliers: (
    caseId: string,
    payload?: SupplierSearchRequest,
    config?: { signal?: AbortSignal }
  ) =>
    longRunningApiClient
      .post<SupplierSearchResult>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/supplier-search`,
        payload,
        { signal: config?.signal }
      )
      .then((r) => r.data),
  getSupplierSearchProgress: (caseId: string, operationId: string) =>
    apiClient
      .get<{
        operation_id: string;
        case_id: string;
        status: string;
        thoughts: string[];
      }>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/supplier-search/progress/${encodeURIComponent(operationId)}`,
        { timeout: 8_000 }
      )
      .then((r) => r.data),
  getSuppliers: (caseId: string) =>
    apiClient
      .get<Supplier[]>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/suppliers`
      )
      .then((r) => r.data),
  createRfqDraft: (caseId: string, payload: CreateRfqDraftPayload) =>
    apiClient
      .post<RfqDraft>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/rfqs/draft`,
        payload
      )
      .then((r) => r.data),
  captureQuote: (caseId: string, payload: CaptureQuotePayload) =>
    apiClient
      .post<SupplierQuote>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/quotes`,
        payload
      )
      .then((r) => r.data),
  getComparison: (caseId: string) =>
    apiClient
      .get<QuoteComparison>(`${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/comparison`)
      .then((r) => r.data),
  createRecommendation: (caseId: string, payload: RecommendationPayload) =>
    apiClient
      .post<RecommendationRecord>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/recommendation`,
        payload
      )
      .then((r) => r.data),
  submitApproval: (caseId: string, payload: ApprovalPayload) =>
    apiClient
      .post<ApprovalRecord>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/approvals`,
        payload
      )
      .then((r) => r.data),
  addShipmentEvent: (caseId: string, payload: ShipmentEventPayload) =>
    apiClient
      .post<Record<string, unknown>>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/shipment-events`,
        payload
      )
      .then((r) => r.data),
  reportNonconformity: (caseId: string, payload: NonconformityPayload) =>
    apiClient
      .post<Record<string, unknown>>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/nonconformity`,
        payload
      )
      .then((r) => r.data),
  getOperation: (operationId: string) =>
    apiClient
      .get<OperationStatus>(`${PROCUREMENT_MANAGER_BASE}/operations/${operationId}`)
      .then((r) => r.data),
  runAgent: (caseId: string, payload?: AgentRunPayload) =>
    longRunningApiClient
      .post<AgentStatus>(`${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/agent/run`, payload)
      .then((r) => r.data),
  resumeAgent: (caseId: string, payload: AgentResumePayload) =>
    longRunningApiClient
      .post<AgentStatus>(`${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/agent/resume`, payload)
      .then((r) => r.data),
  getAgentStatus: (caseId: string) =>
    apiClient
      .get<AgentStatus>(`${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/agent/status`)
      .then((r) => r.data),
  runStrategy: (payload?: StrategyRunPayload) =>
    longRunningApiClient
      .post<StrategyStatus>(`${PROCUREMENT_MANAGER_BASE}/strategy/run`, payload)
      .then((r) => r.data),
  resumeStrategy: (payload: StrategyResumePayload) =>
    longRunningApiClient
      .post<StrategyStatus>(`${PROCUREMENT_MANAGER_BASE}/strategy/resume`, payload)
      .then((r) => r.data),
  getStrategyStatus: () =>
    apiClient
      .get<StrategyStatus>(`${PROCUREMENT_MANAGER_BASE}/strategy/status`)
      .then((r) => r.data),
  listPurchaseOrderDrafts: (caseId: string) =>
    apiClient
      .get<PurchaseOrderDraft[]>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/purchase-order-drafts`
      )
      .then((r) => r.data),
  getPurchaseOrderDraft: (caseId: string, poId: string) =>
    apiClient
      .get<PurchaseOrderDraft>(
        `${PROCUREMENT_MANAGER_BASE}/cases/${caseId}/purchase-order-drafts/${poId}`
      )
      .then((r) => r.data)
};

export const omtoSupportManagerApi = {
  permissions: () =>
    apiClient.get<ProcurementPermissions>("/procurement/me/permissions").then((r) => r.data),
  getDashboard: () =>
    apiClient
      .get<OmtoSupportManagerDashboard>(
        "/procurement/role-agents/omto_support_manager_agent/dashboard"
      )
      .then((r) => r.data),
  getCase: (caseId: string) =>
    apiClient
      .get<OmtoSupportManagerCaseDetail>(
        `/procurement/role-agents/omto_support_manager_agent/cases/${caseId}`
      )
      .then((r) => r.data)
};

function roleAgentApi(agentId: string) {
  return {
    permissions: () =>
      apiClient.get<ProcurementPermissions>("/procurement/me/permissions").then((r) => r.data),
    getDashboard: () =>
      apiClient
        .get<QualityRoleDashboard>(`/procurement/role-agents/${agentId}/dashboard`)
        .then((r) => r.data),
    getCase: (caseId: string) =>
      apiClient
        .get<QualityRoleCaseDetail>(`/procurement/role-agents/${agentId}/cases/${caseId}`)
        .then((r) => r.data)
  };
}

export const otkHeadApi = roleAgentApi("otk_head_agent");
export const qualityEngineerApi = roleAgentApi("quality_engineer_agent");
export const qualityDeputyDirectorApi = roleAgentApi("quality_deputy_director_agent");

export const qualityKpiApi = {
  permissions: () =>
    apiClient.get<ProcurementPermissions>("/procurement/me/permissions").then((r) => r.data),
  getDashboard: (params?: { period_from?: string; period_to?: string }) =>
    apiClient
      .get<QualityKpiReport>("/procurement/quality-kpi/dashboard", { params })
      .then((r) => r.data)
};

const OTK_BASE = "/procurement/role-agents/quality_engineer_agent/otk";

export const otkApi = {
  listPresentations: () =>
    apiClient.get<OtkPresentationListApi>(`${OTK_BASE}/presentations`).then((r) => r.data),
  getPresentation: (presentationId: string) =>
    apiClient
      .get<OtkPresentationCardApi>(`${OTK_BASE}/presentations/${presentationId}`)
      .then((r) => r.data),
  updatePresentation: (presentationId: string, payload: OtkPresentationUpdateApi) =>
    apiClient
      .patch<OtkPresentationCardApi>(`${OTK_BASE}/presentations/${presentationId}`, payload)
      .then((r) => r.data),
  addLine: (presentationId: string, payload: OtkShipmentLineCreateApi) =>
    apiClient
      .post<OtkPresentationCardApi>(`${OTK_BASE}/presentations/${presentationId}/lines`, payload)
      .then((r) => r.data),
  updateLine: (presentationId: string, lineId: string, payload: OtkShipmentLineUpdateApi) =>
    apiClient
      .patch<OtkPresentationCardApi>(
        `${OTK_BASE}/presentations/${presentationId}/lines/${lineId}`,
        payload
      )
      .then((r) => r.data),
  deleteLine: (presentationId: string, lineId: string) =>
    apiClient
      .delete<OtkPresentationCardApi>(
        `${OTK_BASE}/presentations/${presentationId}/lines/${lineId}`
      )
      .then((r) => r.data),
  writeTo1C: (presentationId: string) =>
    apiClient
      .post<OtkWriteTo1CResultApi>(`${OTK_BASE}/presentations/${presentationId}/write-to-1c`)
      .then((r) => r.data)
};

export const healthApi = {
  get: () => apiClient.get<HealthResponse>("/health").then((r) => r.data),
  ready: () => apiClient.get<HealthResponse>("/ready").then((r) => r.data)
};
export const authApi = {
  login: (payload: LoginPayload) => apiClient.post<TokenResponse>("/auth/login", payload).then((r) => r.data),
  loginWith1C: (payload: { fio: string; password: string }) =>
    longRunningApiClient.post<OneCLoginResponse>("/auth/onec/login", payload).then((r) => r.data),
  getOneCSession: () => apiClient.get<OneCSession>("/auth/onec/session").then((r) => r.data),
  me: () => apiClient.get<User>("/auth/me").then((r) => r.data),
  logout: () => apiClient.post("/auth/logout").then((r) => r.data),
  register: (payload: UserCreate) => apiClient.post<User>("/auth/register", payload).then((r) => r.data)
};
export const usersApi = {
  list: () => apiClient.get<User[]>("/users").then((r) => r.data),
  listResponsibleCandidates: () =>
    apiClient.get<ResponsibleUser[]>("/users/responsible-candidates").then((r) => r.data),
  syncFrom1C: () => apiClient.post<EmployeeSyncResult>("/users/sync").then((r) => r.data),
  get: (userId: string) => apiClient.get<User>(`/users/${userId}`).then((r) => r.data),
  create: (payload: UserCreate) => apiClient.post<User>("/admin/users", payload).then((r) => r.data),
  update: (userId: string, payload: UserUpdate) =>
    apiClient.patch<User>(`/users/${userId}`, payload).then((r) => r.data),
  deactivate: (userId: string) => apiClient.post<User>(`/users/${userId}/deactivate`).then((r) => r.data),
  delete: (userId: string) => apiClient.delete<void>(`/admin/users/${userId}`).then((r) => r.data),
  uploadAvatar: (userId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<User>(`/users/${userId}/avatar`, formData).then((r) => r.data);
  }
};
export const departmentsApi = {
  list: () => apiClient.get<Department[]>("/departments").then((r) => r.data),
  listActive: () =>
    apiClient
      .get<Department[]>("/departments", { params: { active_only: true } })
      .then((r) => r.data),
  create: (payload: DepartmentCreate) => apiClient.post<Department>("/departments", payload).then((r) => r.data),
  syncStatus: () => apiClient.get<DepartmentSyncStatus>("/departments/sync/status").then((r) => r.data),
  syncFrom1C: () => apiClient.post<DepartmentSyncStatus>("/departments/sync").then((r) => r.data)
};
export const positionsApi = {
  list: () => apiClient.get<Position[]>("/positions").then((r) => r.data)
};
export const agentsApi = {
  list: () => apiClient.get<Agent[]>("/agents").then((r) => r.data),
  available: () => apiClient.get<AgentAccess[]>("/agents/available").then((r) => r.data),
  access: (agentId: string) =>
    apiClient.get<AgentAccessManagement>(`/agents/${agentId}/access`).then((r) => r.data),
  updateAccess: (agentId: string, payload: { department_grants: AgentDepartmentGrantInput[]; user_grants: AgentUserGrantInput[] }) =>
    apiClient.put<AgentAccessManagement>(`/agents/${agentId}/access`, payload).then((r) => r.data),
  uploadIcon: (agentId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<Agent>(`/agents/${agentId}/icon`, formData).then((r) => r.data);
  }
};
export const rolesApi = {
  list: () => apiClient.get<Role[]>("/roles").then((r) => r.data)
};
export const tasksApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<Task[]>("/tasks", { params }).then((r) => r.data),
  get: (taskId: string) => apiClient.get<Task>(`/tasks/${taskId}`).then((r) => r.data),
  create: (payload: TaskCreate) => apiClient.post<Task>("/tasks", payload).then((r) => r.data),
  steps: (taskId: string) => apiClient.get<TaskStep[]>(`/tasks/${taskId}/steps`).then((r) => r.data),
  result: (taskId: string) => apiClient.get<TaskResult>(`/tasks/${taskId}/result`).then((r) => r.data)
};
export const browserRunsApi = {
  pending: () => apiClient.get<BrowserRun[]>("/browser-runs/pending").then((r) => r.data),
  submitResult: (runId: string, payload: BrowserRunResult) =>
    apiClient.post<BrowserRun>(`/browser-runs/${runId}/result`, payload).then((r) => r.data),
  get: (runId: string) => apiClient.get<BrowserRun>(`/browser-runs/${runId}`).then((r) => r.data)
};
export const documentsApi = {
  upload: (file: File, options: DocumentUploadOptions = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options.title) formData.append("title", options.title);
    if (options.document_type) formData.append("document_type", options.document_type);
    if (options.department_id) formData.append("department_id", options.department_id);
    if (options.task_id) formData.append("task_id", options.task_id);
    if (options.relative_path) formData.append("relative_path", options.relative_path);
    return apiClient
      .post<Document>("/documents/upload", formData, {
        timeout: 0,
        onUploadProgress: (event) => {
          if (!options.onUploadProgress) return;
          const total = event.total || file.size;
          if (!total) return;
          const progress = Math.min(100, Math.round((event.loaded * 100) / total));
          options.onUploadProgress(progress);
        }
      })
      .then((r) => r.data);
  },
  list: (params?: { page?: number; size?: number; query?: string }) =>
    apiClient.get<Page<DocumentListItem>>("/documents", { params }).then((r) => r.data),
  file: (documentId: string, disposition: "inline" | "attachment" = "attachment") =>
    apiClient
      .get<Blob>(`/documents/${documentId}/file`, { params: { disposition }, responseType: "blob" })
      .then((r) => r.data),
  search: (query: string | ChunkSearchQuery) => {
    const body = typeof query === "string" ? { query, top_k: 5 } : query;
    return apiClient.post<ChunkSearchHit[]>("/documents/search", body).then((r) => r.data);
  },
  versions: (documentId: string) =>
    apiClient.get(`/documents/${documentId}/versions`).then((r) => r.data),
  chunks: (documentVersionId: string) =>
    apiClient.get<DocumentChunk[]>(`/documents/versions/${documentVersionId}/chunks`).then((r) => r.data),
  extractedText: (documentVersionId: string) =>
    apiClient.get<Record<string, unknown>>(`/documents/versions/${documentVersionId}/extracted-text`).then((r) => r.data)
};

export const knowledgeBasesApi = {
  stats: () => apiClient.get<KnowledgeBaseStats>("/knowledge-bases/stats").then((r) => r.data),
  listResponsibleUsers: () =>
    apiClient.get<ResponsibleUser[]>("/knowledge-bases/responsible-users").then((r) => r.data),
  list: (params?: { status?: KnowledgeBaseStatus; query?: string }) =>
    apiClient.get<KnowledgeBaseListItem[]>("/knowledge-bases", { params }).then((r) => r.data),
  get: (knowledgeBaseId: string) => apiClient.get<KnowledgeBase>(`/knowledge-bases/${knowledgeBaseId}`).then((r) => r.data),
  create: (payload: KnowledgeBaseCreate) => apiClient.post<KnowledgeBase>("/knowledge-bases", payload).then((r) => r.data),
  delete: (knowledgeBaseId: string) =>
    apiClient.delete<KnowledgeBase>(`/knowledge-bases/${knowledgeBaseId}`).then((r) => r.data),
  confirmReview: (knowledgeBaseId: string) =>
    apiClient.post<KnowledgeBase>(`/knowledge-bases/${knowledgeBaseId}/confirm-review`).then((r) => r.data),
  overview: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseOverviewStats>(`/knowledge-bases/${knowledgeBaseId}/overview`).then((r) => r.data),
  readiness: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseReadiness>(`/knowledge-bases/${knowledgeBaseId}/readiness`).then((r) => r.data),
  sources: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseSource[]>(`/knowledge-bases/${knowledgeBaseId}/sources`).then((r) => r.data),
  addSource: (knowledgeBaseId: string, payload: { document_id: string; document_version_id?: string | null }) =>
    apiClient.post<KnowledgeBaseSource>(`/knowledge-bases/${knowledgeBaseId}/sources`, payload).then((r) => r.data),
  excludeSource: (knowledgeBaseId: string, sourceId: string) =>
    apiClient.post<KnowledgeBaseSource>(`/knowledge-bases/${knowledgeBaseId}/sources/${sourceId}/exclude`).then((r) => r.data),
  reindexSource: (knowledgeBaseId: string, sourceId: string) =>
    apiClient.post<KnowledgeBaseIndexingJob>(`/knowledge-bases/${knowledgeBaseId}/sources/${sourceId}/reindex`).then((r) => r.data),
  deleteSource: (knowledgeBaseId: string, sourceId: string) =>
    apiClient.delete(`/knowledge-bases/${knowledgeBaseId}/sources/${sourceId}`).then((r) => r.data),
  chunks: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseChunk[]>(`/knowledge-bases/${knowledgeBaseId}/chunks`).then((r) => r.data),
  excludeChunk: (knowledgeBaseId: string, chunkId: string, payload: { is_excluded_from_search: boolean; exclusion_reason?: string | null }) =>
    apiClient.patch<KnowledgeBaseChunk>(`/knowledge-bases/${knowledgeBaseId}/chunks/${chunkId}/exclude`, payload).then((r) => r.data),
  rules: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseRule[]>(`/knowledge-bases/${knowledgeBaseId}/rules`).then((r) => r.data),
  access: (knowledgeBaseId: string) =>
    apiClient.get<{ grants: KnowledgeBaseAccessGrantInput[]; exceptions: KnowledgeBaseAccessExceptionInput[] }>(`/knowledge-bases/${knowledgeBaseId}/access`).then((r) => r.data),
  updateAccess: (knowledgeBaseId: string, payload: { grants: KnowledgeBaseAccessGrantInput[]; exceptions?: KnowledgeBaseAccessExceptionInput[] }) =>
    apiClient.put(`/knowledge-bases/${knowledgeBaseId}/access`, payload).then((r) => r.data),
  agents: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseAgentBinding[]>(`/knowledge-bases/${knowledgeBaseId}/agents`).then((r) => r.data),
  updateAgents: (knowledgeBaseId: string, payload: KnowledgeBaseAgentBindingInput[]) =>
    apiClient.put<KnowledgeBaseAgentBinding[]>(`/knowledge-bases/${knowledgeBaseId}/agents`, payload).then((r) => r.data),
  index: (knowledgeBaseId: string, payload: { job_type: KnowledgeBaseIndexJobType; source_id?: string | null }) =>
    apiClient.post<KnowledgeBaseIndexingJob>(`/knowledge-bases/${knowledgeBaseId}/index`, payload).then((r) => r.data),
  cancelIndexing: (knowledgeBaseId: string, payload: { reason?: string | null; force?: boolean } = {}) =>
    longRunningApiClient
      .post<KnowledgeBaseIndexingJob>(`/knowledge-bases/${knowledgeBaseId}/index/cancel`, payload)
      .then((r) => r.data),
  jobs: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseIndexingJob[]>(`/knowledge-bases/${knowledgeBaseId}/index/jobs`).then((r) => r.data),
  jobErrors: (jobId: string) =>
    apiClient.get<KnowledgeBaseIndexingError[]>(`/knowledge-bases/index/jobs/${jobId}/errors`).then((r) => r.data),
  retryIndexingError: (errorId: string) =>
    apiClient.post<KnowledgeBaseIndexingJob>(`/knowledge-bases/index/errors/${errorId}/retry`).then((r) => r.data),
  createRule: (knowledgeBaseId: string, payload: Partial<KnowledgeBaseRule>) =>
    apiClient.post<KnowledgeBaseRule>(`/knowledge-bases/${knowledgeBaseId}/rules`, payload).then((r) => r.data),
  testSearch: (knowledgeBaseId: string, payload: { query: string; top_k?: number; user_id?: string | null; department_id?: string | null; agent_id?: string | null }) =>
    apiClient.post<KnowledgeBaseTestSearchResponse>(`/knowledge-bases/${knowledgeBaseId}/test-search`, payload).then((r) => r.data),
  searchQueries: (knowledgeBaseId: string) =>
    apiClient.get<KnowledgeBaseSearchQuery[]>(`/knowledge-bases/${knowledgeBaseId}/search-queries`).then((r) => r.data),
  createSearchQuery: (knowledgeBaseId: string, payload: { query: string; top_k?: number }) =>
    apiClient.post<KnowledgeBaseSearchQuery>(`/knowledge-bases/${knowledgeBaseId}/search-queries`, payload).then((r) => r.data),
  getSearchQuery: (knowledgeBaseId: string, searchQueryId: string) =>
    apiClient.get<KnowledgeBaseSearchQuery>(`/knowledge-bases/${knowledgeBaseId}/search-queries/${searchQueryId}`).then((r) => r.data),
  cancelSearchQuery: (knowledgeBaseId: string, searchQueryId: string) =>
    apiClient.post<KnowledgeBaseSearchQuery>(`/knowledge-bases/${knowledgeBaseId}/search-queries/${searchQueryId}/cancel`).then((r) => r.data),
  audit: (knowledgeBaseId: string) =>
    apiClient.get<Record<string, unknown>[]>(`/knowledge-bases/${knowledgeBaseId}/audit`).then((r) => r.data)
};

export const agentBuilderApi = {
  listSessions: () => apiClient.get<AgentBuilderSession[]>("/agent-builder/sessions").then((r) => r.data),
  createSession: (payload: { goal: string }) =>
    apiClient.post<AgentBuilderSession>("/agent-builder/sessions", payload).then((r) => r.data),
  getSession: (sessionId: string) =>
    apiClient.get<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}`).then((r) => r.data),
  deleteSession: (sessionId: string) =>
    apiClient.delete(`/agent-builder/sessions/${sessionId}`).then((r) => r.data),
  startSession: (sessionId: string) =>
    longRunningApiClient.post<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}/start`).then((r) => r.data),
  sendMessage: (sessionId: string, payload: { message: string }) =>
    longRunningApiClient
      .post<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}/message`, payload)
      .then((r) => r.data),
  getPlan: (sessionId: string) =>
    apiClient.get<AgentBuilderPlan | null>(`/agent-builder/sessions/${sessionId}/plan`).then((r) => r.data),
  getAttempts: (sessionId: string) =>
    apiClient.get<AgentBuilderAttempt[]>(`/agent-builder/sessions/${sessionId}/attempts`).then((r) => r.data),
  getBlueprint: (sessionId: string) =>
    apiClient.get<AgentBlueprint | null>(`/agent-builder/sessions/${sessionId}/blueprint`).then((r) => r.data),
  approveBlueprint: (sessionId: string) =>
    longRunningApiClient.post<AgentBlueprint>(`/agent-builder/sessions/${sessionId}/approve-blueprint`).then((r) => r.data),
  regenerate: (sessionId: string) =>
    longRunningApiClient.post<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}/regenerate`).then((r) => r.data),
  runPreview: (sessionId: string) =>
    longRunningApiClient.post<AgentBuilderSessionDetail>(`/agent-builder/sessions/${sessionId}/preview`).then((r) => r.data),
  startSandboxRun: (sessionId: string, payload: { test_query?: string | null }) =>
    apiClient.post<SandboxRun>(`/agent-builder/sessions/${sessionId}/sandbox-run`, payload).then((r) => r.data),
  getLatestSandboxRun: (sessionId: string) =>
    apiClient.get<SandboxRun | null>(`/agent-builder/sessions/${sessionId}/sandbox-run`).then((r) => r.data),
  getSandboxRun: (sessionId: string, runId: string) =>
    apiClient.get<SandboxRun>(`/agent-builder/sessions/${sessionId}/sandbox-run/${runId}`).then((r) => r.data),
  listTools: () => apiClient.get<AgentBuilderToolCatalogItem[]>("/agent-builder/tools").then((r) => r.data)
};

export const ndChangeRequestsApi = {
  list: () => apiClient.get<NdChangeRequest[]>("/nd-change-requests").then((r) => r.data),
  create: (payload: NdChangeRequestCreate) => apiClient.post<NdChangeRequest>("/nd-change-requests", payload).then((r) => r.data),
  get: (requestId: string) => apiClient.get<NdChangePreview>(`/nd-change-requests/${requestId}`).then((r) => r.data),
  detectDocument: (requestId: string) =>
    longRunningApiClient
      .post<NdChangeCandidateDocument[]>(`/nd-change-requests/${requestId}/detect-document`)
      .then((r) => r.data),
  selectDocument: (requestId: string, payload: { document_id: string; document_version_id?: string | null }) =>
    apiClient.post<NdChangeRequest>(`/nd-change-requests/${requestId}/select-document`, payload).then((r) => r.data),
  findLocation: (requestId: string, payload: { document_id?: string | null; document_version_id?: string | null } = {}) =>
    longRunningApiClient
      .post<NdChangeTargetLocation[]>(`/nd-change-requests/${requestId}/find-location`, payload)
      .then((r) => r.data),
  applyChanges: (requestId: string, payload: { location_id?: string | null; mark_user_reviewed?: boolean; approval_user_ids?: string[] } = {}) =>
    longRunningApiClient
      .post<NdChangePreview>(`/nd-change-requests/${requestId}/apply-changes`, payload)
      .then((r) => r.data),
  preview: (requestId: string) => apiClient.get<NdChangePreview>(`/nd-change-requests/${requestId}/preview`).then((r) => r.data),
  sendApproval: (requestId: string, payload: { approval_user_ids: string[]; mark_user_reviewed?: boolean }) =>
    apiClient.post(`/nd-change-requests/${requestId}/send-approval`, payload).then((r) => r.data),
  downloadDraft: (requestId: string) =>
    apiClient.get<Blob>(`/nd-change-requests/${requestId}/download-draft`, { responseType: "blob" }).then((r) => r.data),
  downloadNotice: (requestId: string) =>
    apiClient.get<Blob>(`/nd-change-requests/${requestId}/download-notice`, { responseType: "blob" }).then((r) => r.data)
};

export const emailMessagesApi = {
  list: (params?: {
    status?: string;
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
    q?: string;
    recipient_q?: string;
    info_recipient_only?: boolean;
  }) =>
    pochtaApiClient.get<EmailMessagesPage>("/api/v1/email-messages", { params }).then((r) => r.data),
  stats: (params?: {
    status?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
    recipient_q?: string;
    info_recipient_only?: boolean;
  }) =>
    pochtaApiClient.get<EmailMessagesStats>("/api/v1/email-messages/stats", { params }).then((r) => r.data),
  get: (messageRowId: string) =>
    pochtaApiClient.get<EmailMessage>(`/api/v1/email-messages/${messageRowId}`).then((r) => r.data),
  fetchBody: (messageRowId: string) =>
    pochtaApiClient
      .post<EmailMessageFetchBodyResponse>(`/api/v1/email-messages/${messageRowId}/fetch-body`, null, {
        timeout: 90_000
      })
      .then((r) => r.data),
  downloadAttachment: (messageRowId: string, index: number) =>
    pochtaApiClient
      .get<Blob>(`/api/v1/email-messages/${messageRowId}/attachments/${index}`, {
        responseType: "blob",
        timeout: 90_000
      })
      .then((r) => r.data),
  downloadXml: (messageRowId: string) =>
    pochtaApiClient
      .get<Blob>(`/api/v1/email-messages/${messageRowId}/xml`, {
        responseType: "blob",
        timeout: 90_000
      })
      .then((r) => r.data),
  listDepartments: () =>
    pochtaApiClient.get<PochtaDepartment[]>("/api/v1/departments").then((r) => r.data),
  listOrganizations: () =>
    pochtaApiClient.get<PochtaOrganization[]>("/api/v1/organizations").then((r) => r.data),
  searchContractors: (q: string, limit = 20) =>
    pochtaApiClient
      .get<PochtaContractor[]>("/api/v1/contractors/search", { params: { q, limit } })
      .then((r) => r.data),
  restoreFromSpam: (messageRowId: string) =>
    pochtaApiClient
      .post<EmailMessageActionResponse>(`/api/v1/email-messages/${messageRowId}/restore-from-spam`)
      .then((r) => r.data),
  retryErp: (messageRowId: string) =>
    pochtaApiClient
      .post<EmailMessageActionResponse>(`/api/v1/email-messages/${messageRowId}/retry-erp`)
      .then((r) => r.data),
  reanalyze: (messageRowId: string) =>
    pochtaApiClient
      .post<EmailMessageActionResponse>(`/api/v1/email-messages/${messageRowId}/reanalyze`)
      .then((r) => r.data),
  resolveHuman: (
    messageRowId: string,
    body: {
      decision: "approve_routing" | "mark_verified" | "mark_spam" | "mark_not_spam";
      department_id?: string;
      department_name?: string;
      partner_name?: string;
      contractor_id?: string;
      process?: string;
      organization?: string;
    }
  ) =>
    pochtaApiClient
      .post<EmailMessageActionResponse>(`/api/v1/email-messages/${messageRowId}/resolve-human`, body)
      .then((r) => r.data),
  exportReport: (period: "day" | "week" | "month") =>
    pochtaApiClient
      .get<Blob>("/api/v1/email-messages/export", {
        params: { period },
        responseType: "blob",
        timeout: 120_000
      })
      .then((response) => ({
        blob: response.data,
        filename: parseContentDispositionFilename(
          response.headers["content-disposition"],
          `tanyafication_report_${period}.xlsx`
        )
      }))
};

export const ndControlApi = {
  permissions: () => apiClient.get<NdControlPermissions>("/nd-control/me/permissions").then((r) => r.data),
  listChangeJournal: (params: NdChangeJournalParams = {}) =>
    apiClient.get<Page<NdChangeJournalEntry>>("/nd-control/change-journal", { params }).then((r) => r.data),
  getChangeJournalEntry: (entryId: string) =>
    apiClient.get<NdChangeJournalEntry>(`/nd-control/change-journal/${entryId}`).then((r) => r.data),
  templates: {
    types: () => apiClient.get<NdTemplateTypeOption[]>("/nd-control/templates/types").then((r) => r.data),
    list: (params: {
      template_type?: NdTemplateType;
      knowledge_base_id?: string;
      query?: string;
      active_only?: boolean;
      page?: number;
      size?: number;
    } = {}) =>
      apiClient.get<Page<NdControlTemplate>>("/nd-control/templates", { params }).then((r) => r.data),
    get: (templateId: string) =>
      apiClient.get<NdControlTemplateDetail>(`/nd-control/templates/${templateId}`).then((r) => r.data),
    update: (templateId: string, payload: NdControlTemplateUpdate) =>
      apiClient.patch<NdControlTemplateDetail>(`/nd-control/templates/${templateId}`, payload).then((r) => r.data),
    setKnowledgeBases: (templateId: string, payload: NdControlTemplateKnowledgeBasesUpdate) =>
      apiClient
        .put<NdControlTemplateDetail>(`/nd-control/templates/${templateId}/knowledge-bases`, payload)
        .then((r) => r.data),
    documents: (templateId: string, params: { page?: number; size?: number; classification_status?: string } = {}) =>
      apiClient
        .get<Page<NdControlTemplateDocument>>(`/nd-control/templates/${templateId}/documents`, { params })
        .then((r) => r.data),
    addDocument: (templateId: string, payload: NdControlTemplateDocumentCreate) =>
      apiClient
        .post<NdControlTemplateDocument>(`/nd-control/templates/${templateId}/documents`, payload)
        .then((r) => r.data),
    updateDocument: (templateId: string, documentLinkId: string, payload: NdControlTemplateDocumentUpdate) =>
      apiClient
        .patch<NdControlTemplateDocument>(`/nd-control/templates/${templateId}/documents/${documentLinkId}`, payload)
        .then((r) => r.data),
    deleteDocument: (templateId: string, documentLinkId: string) =>
      apiClient.delete(`/nd-control/templates/${templateId}/documents/${documentLinkId}`).then((r) => r.data)
  },
  listTemplateTypes: () => apiClient.get<NdTemplateTypeOption[]>("/nd-control/templates/types").then((r) => r.data),
  listTemplates: (params: {
    template_type?: NdTemplateType;
    knowledge_base_id?: string;
    query?: string;
    active_only?: boolean;
    page?: number;
    size?: number;
  } = {}) =>
    apiClient.get<Page<NdControlTemplate>>("/nd-control/templates", { params }).then((r) => r.data),
  listTemplateSources: (params: {
    knowledge_base_id?: string;
    query?: string;
    include_registered?: boolean;
  } = {}) =>
    apiClient.get<NdControlTemplateSource[]>("/nd-control/templates/sources", { params }).then((r) => r.data),
  createTemplate: (payload: NdControlTemplateCreate) =>
    apiClient.post<NdControlTemplate>("/nd-control/templates", payload).then((r) => r.data),
  updateTemplate: (templateId: string, payload: NdControlTemplateUpdate) =>
    apiClient.patch<NdControlTemplate>(`/nd-control/templates/${templateId}`, payload).then((r) => r.data),
  archiveTemplate: (templateId: string) =>
    apiClient.delete(`/nd-control/templates/${templateId}`).then((r) => r.data),
  listDepartments: () => apiClient.get<NdControlDepartment[]>("/nd-control/departments").then((r) => r.data),
  createDepartment: (payload: NdControlDepartmentCreate) =>
    apiClient.post<NdControlDepartmentCreateResponse>("/nd-control/departments", {
      auto_start_analysis: true,
      ...payload
    }).then((r) => r.data),
  updateDepartment: (departmentId: string, payload: { name?: string; description?: string | null; sort_order?: number }) =>
    apiClient.patch<NdControlDepartment>(`/nd-control/departments/${departmentId}`, payload).then((r) => r.data),
  deleteDepartment: (departmentId: string) =>
    apiClient.delete(`/nd-control/departments/${departmentId}`).then((r) => r.data),
  setDepartmentKnowledgeBases: (departmentId: string, knowledge_base_ids: string[]) =>
    apiClient
      .put<NdControlDepartment>(`/nd-control/departments/${departmentId}/knowledge-bases`, { knowledge_base_ids })
      .then((r) => r.data),
  listDocumentCards: (params: {
    department_id?: string;
    knowledge_base_id?: string;
    query?: string;
    page?: number;
    size?: number;
  } = {}) =>
    apiClient
      .get<Page<NdDocumentCard>>("/nd-control/document-cards", { params })
      .then((r) => r.data),
  getDocumentCard: (cardId: string) =>
    apiClient.get<NdDocumentCard>(`/nd-control/document-cards/${cardId}`).then((r) => r.data),
  updateDocumentCard: (cardId: string, payload: NdDocumentCardUpdate) =>
    apiClient.patch<NdDocumentCard>(`/nd-control/document-cards/${cardId}`, payload).then((r) => r.data),
  startDepartmentAnalysis: (departmentId: string, payload: { force_reextract?: boolean } = {}) =>
    apiClient
      .post<DepartmentAnalysisRun>(`/nd-control/departments/${departmentId}/analyze`, payload)
      .then((r) => r.data),
  cancelDepartmentAnalysis: (departmentId: string) =>
    apiClient
      .post<DepartmentAnalysisRun>(`/nd-control/departments/${departmentId}/analyze/cancel`)
      .then((r) => r.data),
  getDepartmentAnalysisStatus: (departmentId: string) =>
    apiClient
      .get<DepartmentAnalysisStatus>(`/nd-control/departments/${departmentId}/analysis-status`)
      .then((r) => r.data),
  getDepartmentSummary: (departmentId: string) =>
    apiClient.get<DepartmentSummary>(`/nd-control/departments/${departmentId}/summary`).then((r) => r.data),
  listDepartmentDocumentCards: (
    departmentId: string,
    params: {
      query?: string;
      document_type?: string;
      document_level?: string;
      page?: number;
      size?: number;
    } = {}
  ) =>
    apiClient
      .get<Page<DepartmentStructuralDocumentCard>>(`/nd-control/departments/${departmentId}/document-cards`, {
        params
      })
      .then((r) => r.data),
  listDepartmentProcesses: (
    departmentId: string,
    params: { query?: string; filter?: string; sort?: string; page?: number; size?: number } = {}
  ) =>
    apiClient
      .get<Page<DepartmentProcessItem>>(`/nd-control/departments/${departmentId}/processes`, { params })
      .then((r) => r.data),
  listDepartmentRelations: (
    departmentId: string,
    params: {
      query?: string;
      filter?: string;
      relation_type?: string;
      confidence?: string;
      extraction_type?: string;
      process_id?: string;
      page?: number;
      size?: number;
    } = {}
  ) =>
    apiClient
      .get<Page<DepartmentRelationItem>>(`/nd-control/departments/${departmentId}/relations`, { params })
      .then((r) => r.data),
  listDepartmentAnalysisRuns: (departmentId: string, params: { page?: number; size?: number } = {}) =>
    apiClient
      .get<Page<DepartmentAnalysisRunListItem>>(`/nd-control/departments/${departmentId}/analysis-runs`, { params })
      .then((r) => r.data),
  listReviewPending: (departmentId: string, params: { query?: string; filter?: string } = {}) =>
    apiClient
      .get<DepartmentReviewPending>("/nd-control/review/pending", {
        params: { department_id: departmentId, ...params }
      })
      .then((r) => r.data),
  approveRelation: (relationId: string) =>
    apiClient.post(`/nd-control/review/relations/${relationId}/approve`).then((r) => r.data),
  bulkApproveRelations: (relationIds: string[]) =>
    apiClient
      .post<{ approved: string[]; skipped: string[] }>("/nd-control/review/relations/bulk-approve", {
        relation_ids: relationIds
      })
      .then((r) => r.data),
  rejectRelation: (relationId: string) =>
    apiClient.post(`/nd-control/review/relations/${relationId}/reject`).then((r) => r.data),
  confirmProcessOwner: (processId: string, payload: { owner_name?: string }) =>
    apiClient.post(`/nd-control/review/processes/${processId}/confirm-owner`, payload).then((r) => r.data),
  getProcessUml: (
    processId: string,
    params: { force?: boolean; detail_level?: "compact" | "standard" | "detailed" } = {}
  ) =>
    longRunningApiClient
      .get<ProcessUmlResponse>(`/nd-control/processes/${processId}/uml`, { params })
      .then((r) => r.data),
};
function parseContentDispositionFilename(
  contentDisposition: string | undefined,
  fallback: string
): string {
  if (contentDisposition) {
    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utfMatch?.[1]) {
      return decodeURIComponent(utfMatch[1]);
    }
    const plainMatch = /filename="([^"]+)"/i.exec(contentDisposition);
    if (plainMatch?.[1]) {
      return plainMatch[1];
    }
  }
  return fallback;
}
