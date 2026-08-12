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
  DeveloperFeedbackMessagesResponse,
  DeveloperFeedbackSendResponse,
  DeveloperFeedbackThread,
  DeveloperFeedbackThreadsResponse,
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
  MeetingPermissions,
  MeetingRun,
  MeetingRunCreate,
  MeetingRunResult,
  MeetingAgentSlotPreview,
  MeetingAgentSlotPreviewRequest,
  MeetingAgentSlotApprove,
  MeetingAgentSlotApproveRequest,
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
  ProductionPreparationEngineerDashboard,
  ProcurementRefreshResult,
  ProcurementRoleAgentResult,
  ProcurementRoleAgentResume,
  ProcurementSyncStatus
} from "@/types/procurement";

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
  getMemoDetail: (memoRefKey: string, options?: { forceRefresh?: boolean }) =>
    apiClient
      .get<MeetingMemoDetail>(`/meetings/memos/${memoRefKey}/detail`, {
        params: options?.forceRefresh ? { force_refresh: true } : undefined
      })
      .then((r) => r.data),
  findSlots: (payload: MeetingSlotsRequest) =>
    apiClient.post<MeetingSlot[]>("/meetings/slots", payload).then((r) => r.data),
  slotPreview: (memoRefKey: string, payload?: MeetingAgentSlotPreviewRequest) =>
    longRunningApiClient
      .post<MeetingAgentSlotPreview>(`/meetings/memos/${memoRefKey}/agent/slot-preview`, payload ?? {})
      .then((r) => r.data),
  approveSlot: (memoRefKey: string, payload: MeetingAgentSlotApproveRequest) =>
    longRunningApiClient
      .post<MeetingAgentSlotApprove>(`/meetings/memos/${memoRefKey}/agent/approve`, payload)
      .then((r) => r.data),
  createRun: (payload: MeetingRunCreate) =>
    apiClient.post<MeetingRun>("/meetings/runs", payload).then((r) => r.data),
  getRun: (taskId: string) => apiClient.get<MeetingRunResult>(`/meetings/runs/${taskId}`).then((r) => r.data)
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
  getDashboard: () =>
    apiClient
      .get<ProductionPreparationEngineerDashboard>(
        "/procurement/role-agents/production_preparation_engineer_agent/dashboard"
      )
      .then((r) => r.data),
  getCase: (caseId: string) =>
    apiClient
      .get<ProductionPreparationEngineerCaseDetail>(
        `/procurement/role-agents/production_preparation_engineer_agent/cases/${caseId}`
      )
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
  uploadAvatar: (userId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<User>(`/users/${userId}/avatar`, formData).then((r) => r.data);
  }
};
export const departmentsApi = {
  list: () => apiClient.get<Department[]>("/departments").then((r) => r.data),
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
  },
  /** Показать файл в проводнике Windows (backend: explorer /select). */
  revealAveonFileInExplorer: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient
      .post<{ ok: boolean; path: string }>("/agents/document-analysis/reveal-in-explorer", formData)
      .then((r) => r.data);
  },
  listAvionDeveloperFeedbackThreads: () =>
    apiClient
      .get<DeveloperFeedbackThreadsResponse>("/agents/document-analysis/developer-feedback/threads")
      .then((r) => r.data),
  getAvionDeveloperFeedbackMessages: (threadId: string) =>
    apiClient
      .get<DeveloperFeedbackMessagesResponse>(
        `/agents/document-analysis/developer-feedback/threads/${threadId}/messages`
      )
      .then((r) => r.data),
  sendAvionDeveloperFeedback: (message: string, files: File[]) => {
    const formData = new FormData();
    formData.append("message", message);
    files.forEach((file) => formData.append("files", file));
    return apiClient
      .post<DeveloperFeedbackSendResponse>(
        "/agents/document-analysis/developer-feedback",
        formData
      )
      .then((r) => r.data);
  },
  sendAvionDeveloperFeedbackMessage: (threadId: string, message: string, files: File[]) => {
    const formData = new FormData();
    formData.append("message", message);
    files.forEach((file) => formData.append("files", file));
    return apiClient
      .post<DeveloperFeedbackSendResponse>(
        `/agents/document-analysis/developer-feedback/threads/${threadId}/messages`,
        formData
      )
      .then((r) => r.data);
  },
  markAvionDeveloperFeedbackThreadRead: (threadId: string) =>
    apiClient
      .post<DeveloperFeedbackThread>(`/agents/document-analysis/developer-feedback/threads/${threadId}/read`)
      .then((r) => r.data),
  downloadAvionDeveloperFeedbackAttachment: (attachmentId: string) =>
    apiClient
      .get<Blob>(`/agents/document-analysis/developer-feedback/attachments/${attachmentId}`, {
        responseType: "blob"
      })
      .then((r) => r.data),

  classifyAveonExcel: (files: File[], options?: { signal?: AbortSignal }) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return longRunningApiClient
      .post<{
        source: string;
        roles: Array<{ filename: string; role: string }>;
      }>("/agents/document-analysis/classify-excel", formData, {
        timeout: 60000,
        signal: options?.signal
      })
      .then((r) => ({
        source: r.data.source,
        roles: r.data.roles ?? []
      }));
  },
  analyzeAveonExcel: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return longRunningApiClient
      .post<{
        source: string;
        roles: Array<{ filename: string; role: string }>;
        production_schedule_files: string[];
        production_schedule_products: string[];
        production_schedule_plans: Array<{
          product: string;
          monthly_qty: Record<string, number>;
        }>;
        product_spec_links: Array<{
          schedule_product: string;
          nomenclature: string | null;
          spec_sheet: string | null;
          status: string;
          reason: string;
        }>;
        material_usages_count: number;
        merged_nomenclatures_count: number;
        price_matched_count: number;
        stock_files: string[];
        stock_matched_count: number;
        shipment_files: string[];
        receipts_nonzero_count: number;
        forecast_deficit_count: number;
        logistics_risks: {
          as_of: string | null;
          stages: Array<{
            key: string;
            label: string;
            items: Array<{
              nomenclature: string;
              supplier: string | null;
              quantity: number;
              moscow_date: string;
              milestone_date: string;
              sheet: string;
              window_start: string;
              window_end: string;
              days_remaining: number;
              risk_ratio: number;
              risk_level: string;
            }>;
          }>;
        };
        file_name: string;
        file_base64: string | null;
        shift_assignment_file_name?: string;
        shift_assignment_file_base64?: string | null;
        shift_assignment_values?: string[][];
        shift_assignment_row_priorities?: Array<"urgent" | "today" | "week" | null>;
        shift_assignment_row_kinds?: Array<"header" | "group" | "task" | "empty">;
        shift_assignment_meta?: {
          as_of?: string;
          week_period?: string;
          week_in_period?: boolean;
          task_count?: number;
          urgent_count?: number;
          today_count?: number;
          week_count?: number;
        };
        schedule_diff_has_changes?: boolean;
        schedule_diff_changed_months?: string[];
        schedule_diff_changed_cells?: number;
        schedule_diff_file_name?: string;
        schedule_diff_file_base64?: string | null;
        schedule_diff_old_version?: string;
        schedule_diff_new_version?: string;
        schedule_diff_message?: string;
        schedule_baseline_saved?: boolean;
        schedule_compared_with_saved?: boolean;
        detailed_diff_has_changes?: boolean;
        detailed_diff_changed_dates?: string[];
        detailed_diff_changed_cells?: number;
        detailed_diff_file_name?: string;
        detailed_diff_file_base64?: string | null;
        detailed_diff_old_version?: string;
        detailed_diff_new_version?: string;
        detailed_diff_message?: string;
        detailed_baseline_saved?: boolean;
        detailed_compared_with_saved?: boolean;
        coverage_dashboard?: unknown;
        dashboard_analyzed_at?: string | null;
      }>("/agents/document-analysis/analyze-excel", formData, {
        timeout: 600000
      })
      .then((r) => ({
        source: r.data.source,
        roles: r.data.roles ?? [],
        productionScheduleFiles: r.data.production_schedule_files ?? [],
        productionScheduleProducts: r.data.production_schedule_products ?? [],
        productionSchedulePlans: r.data.production_schedule_plans ?? [],
        productSpecLinks: r.data.product_spec_links ?? [],
        materialUsagesCount: r.data.material_usages_count ?? 0,
        mergedNomenclaturesCount: r.data.merged_nomenclatures_count ?? 0,
        priceMatchedCount: r.data.price_matched_count ?? 0,
        stockFiles: r.data.stock_files ?? [],
        stockMatchedCount: r.data.stock_matched_count ?? 0,
        shipmentFiles: r.data.shipment_files ?? [],
        receiptsNonzeroCount: r.data.receipts_nonzero_count ?? 0,
        forecastDeficitCount: r.data.forecast_deficit_count ?? 0,
        logisticsRisks: {
          asOf: r.data.logistics_risks?.as_of ?? null,
          stages: (r.data.logistics_risks?.stages ?? []).map((stage) => ({
            key: stage.key,
            label: stage.label,
            items: (stage.items ?? []).map((item) => ({
              nomenclature: item.nomenclature,
              supplier: item.supplier,
              quantity: item.quantity,
              moscowDate: item.moscow_date,
              milestoneDate: item.milestone_date,
              sheet: item.sheet,
              windowStart: item.window_start ?? "",
              windowEnd: item.window_end ?? item.milestone_date ?? "",
              daysRemaining: item.days_remaining ?? 0,
              riskRatio: item.risk_ratio ?? 0,
              riskLevel: item.risk_level ?? "critical"
            }))
          }))
        },
        fileName: r.data.file_name || "result.xlsx",
        fileBase64: r.data.file_base64,
        shiftAssignmentFileName:
          r.data.shift_assignment_file_name || "сменное_задание_закупки.xlsx",
        shiftAssignmentFileBase64: r.data.shift_assignment_file_base64 ?? null,
        shiftAssignmentValues: r.data.shift_assignment_values ?? [],
        shiftAssignmentRowPriorities: r.data.shift_assignment_row_priorities ?? [],
        shiftAssignmentRowKinds: r.data.shift_assignment_row_kinds ?? [],
        shiftAssignmentMeta: r.data.shift_assignment_meta
          ? {
              asOf: r.data.shift_assignment_meta.as_of ?? "",
              weekPeriod: r.data.shift_assignment_meta.week_period ?? "",
              weekInPeriod: Boolean(r.data.shift_assignment_meta.week_in_period),
              taskCount: r.data.shift_assignment_meta.task_count ?? 0,
              urgentCount: r.data.shift_assignment_meta.urgent_count ?? 0,
              todayCount: r.data.shift_assignment_meta.today_count ?? 0,
              weekCount: r.data.shift_assignment_meta.week_count ?? 0
            }
          : null,
        scheduleDiffHasChanges: Boolean(r.data.schedule_diff_has_changes),
        scheduleDiffChangedMonths: r.data.schedule_diff_changed_months ?? [],
        scheduleDiffChangedCells: r.data.schedule_diff_changed_cells ?? 0,
        scheduleDiffFileName:
          r.data.schedule_diff_file_name || "график_производства_изменения.xlsx",
        scheduleDiffFileBase64: r.data.schedule_diff_file_base64 ?? null,
        scheduleDiffOldVersion: r.data.schedule_diff_old_version ?? "",
        scheduleDiffNewVersion: r.data.schedule_diff_new_version ?? "",
        scheduleDiffMessage: r.data.schedule_diff_message ?? "",
        scheduleBaselineSaved: Boolean(r.data.schedule_baseline_saved),
        scheduleComparedWithSaved: Boolean(r.data.schedule_compared_with_saved),
        detailedDiffHasChanges: Boolean(r.data.detailed_diff_has_changes),
        detailedDiffChangedDates: r.data.detailed_diff_changed_dates ?? [],
        detailedDiffChangedCells: r.data.detailed_diff_changed_cells ?? 0,
        detailedDiffFileName:
          r.data.detailed_diff_file_name || "детальный_график_изменения.xlsx",
        detailedDiffFileBase64: r.data.detailed_diff_file_base64 ?? null,
        detailedDiffOldVersion: r.data.detailed_diff_old_version ?? "",
        detailedDiffNewVersion: r.data.detailed_diff_new_version ?? "",
        detailedDiffMessage: r.data.detailed_diff_message ?? "",
        detailedBaselineSaved: Boolean(r.data.detailed_baseline_saved),
        detailedComparedWithSaved: Boolean(r.data.detailed_compared_with_saved),
        coverageDashboard: r.data.coverage_dashboard ?? null,
        dashboardAnalyzedAt: r.data.dashboard_analyzed_at ?? null
      }));
  },

  getAveonDashboardLatest: () =>
    longRunningApiClient
      .get<{
        ok: boolean;
        snapshot: {
          analyzed_at: string;
          logistics_risks: {
            as_of: string | null;
            stages: Array<{
              key: string;
              label: string;
              items: Array<{
                nomenclature: string;
                supplier: string | null;
                quantity: number;
                moscow_date: string;
                milestone_date: string;
                sheet: string;
                window_start: string;
                window_end: string;
                days_remaining: number;
                risk_ratio: number;
                risk_level: string;
              }>;
            }>;
          };
          task_dashboard?: {
            values: string[][];
            row_priorities: Array<"urgent" | "today" | "week" | null>;
            row_kinds: Array<"header" | "group" | "task" | "empty">;
            meta?: {
              as_of?: string;
              week_period?: string;
              week_in_period?: boolean;
              task_count?: number;
              urgent_count?: number;
              today_count?: number;
              week_count?: number;
            };
            result_texts?: Record<string, string>;
            result_evals?: Record<
              string,
              { status?: string; comment?: string; error?: string }
            >;
          } | null;
          shift_assignment?: {
            valid_date: string;
            file_name: string;
            file_base64: string;
          } | null;
          shift_day_expired?: boolean;
          shift_previous_valid_date?: string | null;
          shift_today_msk?: string;
          dashboard_date_msk?: string | null;
          refresh_status?: string | null;
          refresh_error?: string | null;
          refresh_attempted_date_msk?: string | null;
          merged_shipment_schedule?: {
            file_name: string;
            file_base64: string;
            values?: string[][];
            stats?: {
              nomenclature_total?: number;
              date_columns?: number;
              ingested_files?: string[];
            };
            source_count?: number;
            changed_cells?: Array<{ row: number; col: number }>;
          } | null;
          coverage_dashboard?: unknown;
        } | null;
      }>("/agents/document-analysis/dashboard-latest")
      .then((r) => {
        if (!r.data.ok || !r.data.snapshot) return null;
        const snap = r.data.snapshot;
        const taskDash = snap.task_dashboard;
        const shiftSnap = snap.shift_assignment;
        const shipmentSnap = snap.merged_shipment_schedule;
        return {
          analyzedAt: snap.analyzed_at,
          logisticsRisks: {
            asOf: snap.logistics_risks?.as_of ?? null,
            stages: (snap.logistics_risks?.stages ?? []).map((stage) => ({
              key: stage.key,
              label: stage.label,
              items: (stage.items ?? []).map((item) => ({
                nomenclature: item.nomenclature,
                supplier: item.supplier,
                quantity: item.quantity,
                moscowDate: item.moscow_date,
                milestoneDate: item.milestone_date,
                sheet: item.sheet,
                windowStart: item.window_start ?? "",
                windowEnd: item.window_end ?? item.milestone_date ?? "",
                daysRemaining: item.days_remaining ?? 0,
                riskRatio: item.risk_ratio ?? 0,
                riskLevel: item.risk_level ?? "critical"
              }))
            }))
          },
          taskDashboard: taskDash?.values?.length
            ? {
                values: taskDash.values,
                rowPriorities: taskDash.row_priorities ?? [],
                rowKinds: taskDash.row_kinds ?? [],
                meta: taskDash.meta
                  ? {
                      asOf: taskDash.meta.as_of ?? "",
                      weekPeriod: taskDash.meta.week_period ?? "",
                      weekInPeriod: Boolean(taskDash.meta.week_in_period),
                      taskCount: taskDash.meta.task_count ?? 0,
                      urgentCount: taskDash.meta.urgent_count ?? 0,
                      todayCount: taskDash.meta.today_count ?? 0,
                      weekCount: taskDash.meta.week_count ?? 0
                    }
                  : null,
                resultTexts: taskDash.result_texts ?? {},
                resultEvals: Object.fromEntries(
                  Object.entries(taskDash.result_evals ?? {}).map(([key, value]) => [
                    key,
                    {
                      status: value.status as
                        | "resolved"
                        | "partial"
                        | "not_resolved"
                        | undefined,
                      comment: value.comment,
                      error: value.error
                    }
                  ])
                )
              }
            : null,
          shiftAssignment: shiftSnap?.file_base64
            ? {
                fileName: shiftSnap.file_name,
                fileBase64: shiftSnap.file_base64,
                validDate: shiftSnap.valid_date
              }
            : null,
          mergedShipmentSchedule: shipmentSnap?.file_base64
            ? {
                fileName: shipmentSnap.file_name,
                fileBase64: shipmentSnap.file_base64,
                values: shipmentSnap.values ?? [],
                stats: shipmentSnap.stats ?? null,
                sourceCount: shipmentSnap.source_count ?? 0,
                changedCells: shipmentSnap.changed_cells ?? []
              }
            : null,
          coverageDashboard: snap.coverage_dashboard ?? null,
          shiftDayExpired: Boolean(snap.shift_day_expired),
          shiftPreviousValidDate: snap.shift_previous_valid_date ?? null,
          shiftTodayMsk: snap.shift_today_msk ?? null,
          dashboardDateMsk: snap.dashboard_date_msk ?? null,
          autoRefreshStatus: snap.refresh_status ?? null,
          autoRefreshError: snap.refresh_error ?? null,
          autoRefreshAttemptedDateMsk: snap.refresh_attempted_date_msk ?? null
        };
      }),

  clearAveonDashboardLatest: () =>
    apiClient.delete<{ ok: boolean; removed: boolean }>("/agents/document-analysis/dashboard-latest").then((r) => r.data),

  /** TEMP(Aveon OData ping) — удалить вместе с кнопкой на странице агента */
  tempAveonOdataPing: () =>
    longRunningApiClient
      .post<{
        ok: boolean;
        message: string;
        status_code: number | null;
        url: string;
        base?: string;
        source?: string;
        count?: number;
        positive_count?: number;
        negative_count?: number;
        saved_count?: number;
        db_count?: number;
        db_match?: boolean;
        sync_run_id?: string;
        items?: Array<{
          code: string;
          name: string;
          warehouse: string;
          in_stock: number;
          to_ship: number;
          available: number;
          nomenclature_key?: string;
          warehouse_key?: string;
        }>;
      }>("/agents/document-analysis/temp-odata-ping")
      .then((r) => r.data),

  /** TEMP(Aveon resource specs) — удалить вместе с кнопкой на странице агента */
  tempAveonResourceSpecsSync: () =>
    longRunningApiClient
      .post<{
        ok: boolean;
        message: string;
        folder_path?: string[];
        folder_ref_key?: string;
        count?: number;
        materials_count?: number;
        outputs_count?: number;
        saved_specs?: number;
        saved_materials?: number;
        saved_outputs?: number;
        db_specs?: number;
        db_materials?: number;
        db_outputs?: number;
        db_match?: boolean;
        sync_run_id?: string;
        items?: Array<{
          ref_key?: string;
          code: string;
          description: string;
          status: string;
          process_type?: string;
          main_product_code?: string;
          main_product: string;
          main_product_qty?: number;
          materials_count: number;
          outputs_count: number;
        }>;
        materials?: Array<{
          spec_code: string;
          spec_name: string;
          line: number;
          code: string;
          name: string;
          qty: number;
        }>;
        outputs?: Array<{
          spec_code: string;
          spec_name: string;
          line: number;
          code: string;
          name: string;
          qty: number;
        }>;
      }>("/agents/document-analysis/temp-resource-specs-sync")
      .then((r) => r.data),

  /** TEMP(Aveon Google Sheets probe) — удалить вместе с кнопкой на странице агента */
  tempAveonGoogleSheetsProbe: () =>
    apiClient
      .post<{
        ok: boolean;
        message: string;
        spreadsheet_id: string;
        sheet_gid: string;
        spreadsheet_url: string;
        service_account_configured: boolean;
        service_account_email: string | null;
        copy_hint: string;
        recommendations: string[];
        api: {
          name: string;
          ok: boolean;
          spreadsheet_id: string;
          sheet_gid: string;
          service_account_email: string | null;
          elapsed_ms: number | null;
          error: string | null;
          hint: string | null;
          parsed: Record<string, unknown> | null;
        };
        attempts: Array<{
          name: string;
          url?: string;
          ok: boolean;
          status_code?: number | null;
          content_type?: string | null;
          content_length?: number | null;
          elapsed_ms: number | null;
          final_url?: string | null;
          redirects?: Array<{ status: number; url: string }>;
          error: string | null;
          hint: string | null;
          body_preview?: string | null;
          parsed: Record<string, unknown> | null;
        }>;
      }>("/agents/document-analysis/temp-google-sheets-probe")
      .then((r) => r.data),

  fetchAveonGoogleSheets: () =>
    apiClient
      .post<{
        ok: boolean;
        name: string;
        spreadsheet_id: string;
        sheet_gid: string | null;
        sheet_title?: string;
        service_account_email: string | null;
        elapsed_ms: number | null;
        hint: string | null;
        error?: string | null;
        parsed: {
          format?: string;
          spreadsheet_title?: string;
          sheet_title?: string;
          sheet_gid?: number | string;
          row_count?: number;
          column_count?: number;
          preview_rows?: string[][];
          values?: string[][];
        } | null;
      }>("/agents/document-analysis/google-sheets/fetch")
      .then((r) => r.data),

  getAveonGoogleSheetsStatus: () =>
    apiClient
      .get<{
        ok: boolean;
        configured: boolean;
        service_account_email: string | null;
        spreadsheet_id: string;
        sheet_gid: string;
      }>("/agents/document-analysis/google-sheets/status")
      .then((r) => r.data),

  getAveonOnecSyncStatus: () =>
    apiClient
      .get<{
        ok: boolean;
        stock: {
          last_sync_at: string | null;
          status: string | null;
          saved_count: number;
          db_count: number;
          positive_count?: number;
          negative_count?: number;
          error_message?: string | null;
        };
        resource_specs: {
          last_sync_at: string | null;
          status: string | null;
          specs_count: number;
          materials_count: number;
          outputs_count: number;
          db_specs: number;
          db_materials: number;
          db_outputs: number;
          error_message?: string | null;
        };
      }>("/agents/document-analysis/onec-sync-status")
      .then((r) => r.data),

  runAveonOnecSyncNow: () =>
    apiClient
      .post<{
        ok: boolean;
        status?: string;
        stock?: { ok?: boolean; message?: string };
        resource_specs?: { ok?: boolean; message?: string };
      }>("/agents/document-analysis/onec-sync-now", null, { timeout: 600000 })
      .then((r) => r.data),

  getAveonScheduleSnapshotStatus: () =>
    apiClient
      .get<{
        ok: boolean;
        has_production: boolean;
        has_detailed: boolean;
        production_version: string;
        production_filename: string;
        production_saved_at: string;
        detailed_version: string;
        detailed_filename: string;
        detailed_saved_at: string;
        detailed_schedules: Array<{
          month: string;
          year: number;
          month_num: number;
          filename: string;
          version_label: string;
          saved_at: string;
          has_file: boolean;
        }>;
      }>("/agents/document-analysis/schedule-snapshot-status")
      .then((r) => r.data),

  listAveonResourceSpecs: (params?: { status?: string; q?: string; limit?: number; offset?: number }) =>
    apiClient
      .get<{
        ok: boolean;
        total: number;
        items: Array<{
          ref_key: string;
          code: string;
          description: string;
          status: string;
          main_product_name: string;
          materials_count: number;
          outputs_count: number;
        }>;
      }>("/agents/document-analysis/resource-specs", { params })
      .then((r) => r.data),

  getAveonResourceSpec: (refKey: string) =>
    apiClient
      .get<{
        ok: boolean;
        spec: {
          ref_key: string;
          code: string;
          description: string;
          status: string;
          main_product: { key: string; code: string; name: string; qty: number };
          synced_at?: string | null;
          materials: Array<{ code: string; name: string; qty: number; line_number: number }>;
          outputs: Array<{ code: string; name: string; qty: number; line_number: number }>;
        };
      }>(`/agents/document-analysis/resource-specs/${encodeURIComponent(refKey)}`)
      .then((r) => r.data),

  mergeShipmentSchedules: (files: File[]) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    return apiClient
      .post<{
        ok: boolean;
        message: string;
        files: Array<{ name: string; size?: number }>;
        file_name?: string;
        file_base64?: string;
        preview_values?: string[][];
        stats?: Record<string, unknown>;
      }>("/agents/document-analysis/merge-shipment-schedules", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600_000
      })
      .then((r) => r.data);
  },

  previewShipmentSchedule: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient
      .post<{
        ok: boolean;
        file_name: string;
        preview_values: string[][];
        row_count: number;
      }>("/agents/document-analysis/shipment-schedule/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000
      })
      .then((r) => r.data);
  },

  getCurrentRussiaShipmentSchedule: () =>
    apiClient
      .get<{
        ok: boolean;
        schedule: null | {
          id: string;
          country_scope: string;
          source_type: string;
          file_name: string;
          file_sha256: string;
          preview_values?: string[][];
          stats?: Record<string, unknown>;
          changed_cells?: Array<{ row: number; col: number }>;
          is_active: boolean;
          created_reason?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      }>("/agents/document-analysis/shipment-schedule/current")
      .then((r) => r.data),

  uploadRussiaShipmentSchedule: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient
      .post<{
        ok: boolean;
        schedule: {
          id: string;
          country_scope: string;
          source_type: string;
          file_name: string;
          file_sha256: string;
          preview_values?: string[][];
          stats?: Record<string, unknown>;
          changed_cells?: Array<{ row: number; col: number }>;
          is_active: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      }>("/agents/document-analysis/shipment-schedule/russia/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600_000
      })
      .then((r) => r.data);
  },

  saveMergedShipmentSnapshot: (payload: {
    fileName: string;
    fileBase64: string;
    previewValues: string[][];
    stats?: Record<string, unknown> | null;
    sourceCount?: number;
    changedCells?: Array<{ row: number; col: number }>;
  }) =>
    apiClient
      .post<{ ok: boolean }>("/agents/document-analysis/shipment-schedule/snapshot", {
        file_name: payload.fileName,
        file_base64: payload.fileBase64,
        preview_values: payload.previewValues,
        stats: payload.stats ?? {},
        source_count: payload.sourceCount ?? 0,
        changed_cells: payload.changedCells ?? []
      })
      .then((r) => r.data),

  applyShipmentManagerDateChange: (payload: {
    fileName: string;
    fileBase64: string;
    taskType: string;
    problem: string;
    solution: string;
    nomenclature: string;
    managerResult: string;
    taskKey?: string | null;
    managerName?: string | null;
  }) =>
    apiClient
      .post<{
        ok: boolean;
        applied: boolean;
        message: string;
        file_name?: string;
        file_base64?: string;
        preview_values?: string[][];
        changed_cells?: Array<{ row: number; col: number }>;
        country?: string | null;
        supplier?: string | null;
        matched_row?: number;
        persisted?: boolean;
        manual_action_required?: boolean;
        already_processed?: boolean;
        change?: {
          nomenclature: string;
          original_date?: string;
          new_date?: string;
          quantity?: number;
          remove_dates?: string[];
          add_batches?: Array<{ date: string; quantity: number }>;
        };
      }>("/agents/document-analysis/shipment-schedule/apply-manager-date-change", {
        file_name: payload.fileName,
        file_base64: payload.fileBase64,
        task_key: payload.taskKey ?? null,
        manager_name: payload.managerName ?? null,
        task_type: payload.taskType,
        problem: payload.problem,
        solution: payload.solution,
        nomenclature: payload.nomenclature,
        manager_result: payload.managerResult
      }, { timeout: 120_000 })
      .then((r) => r.data),

  pruneProductionSchedules: (files: File[]) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    return apiClient
      .post<{
        ok: boolean;
        message: string;
        kept: Array<{ filename: string; version: number; version_label: string }>;
        removed: Array<{ filename: string; version: number; version_label: string }>;
      }>("/agents/document-analysis/prune-production-schedules", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000
      })
      .then((r) => r.data);
  },

  pruneDetailedSchedules: (files: File[]) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    return apiClient
      .post<{
        ok: boolean;
        message: string;
        kept: Array<{ filename: string; version: number; version_label: string }>;
        removed: Array<{ filename: string; version: number; version_label: string }>;
      }>("/agents/document-analysis/prune-detailed-schedules", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000
      })
      .then((r) => r.data);
  },

  evaluateShiftAssignmentResult: (payload: {
    taskType: string;
    problem: string;
    solution: string;
    nomenclature: string;
    managerResult: string;
  }) =>
    apiClient
      .post<{
        status: "resolved" | "partial" | "not_resolved";
        comment: string;
        source: string;
      }>("/agents/document-analysis/shift-assignment/evaluate-result", {
        task_type: payload.taskType,
        problem: payload.problem,
        solution: payload.solution,
        nomenclature: payload.nomenclature,
        manager_result: payload.managerResult
      }, { timeout: 120_000 })
      .then((r) => ({
        status: r.data.status,
        comment: r.data.comment ?? "",
        source: r.data.source ?? "lm_studio"
      })),

  suggestShiftAssignmentResult: (payload: {
    taskType: string;
    problem: string;
    solution: string;
    nomenclature: string;
    draft: string;
  }) =>
    apiClient
      .post<{
        suggestion: string;
        source: string;
      }>("/agents/document-analysis/shift-assignment/suggest-result", {
        task_type: payload.taskType,
        problem: payload.problem,
        solution: payload.solution,
        nomenclature: payload.nomenclature,
        draft: payload.draft
      }, { timeout: 90_000 })
      .then((r) => ({
        suggestion: r.data.suggestion ?? "",
        source: r.data.source ?? "lm_studio"
      })),

  saveShiftAssignmentProgress: (payload: {
    resultTexts: Record<string, string>;
    resultEvals: Record<
      string,
      { status?: string; comment?: string; error?: string; loading?: boolean }
    >;
  }) =>
    apiClient
      .post<{ ok: boolean }>("/agents/document-analysis/shift-assignment/progress", {
        result_texts: payload.resultTexts,
        result_evals: Object.fromEntries(
          Object.entries(payload.resultEvals).map(([key, value]) => [
            key,
            {
              status: value.status,
              comment: value.comment,
              error: value.error
            }
          ])
        )
      })
      .then((r) => r.data),

  completeShiftAssignment: (payload: {
    reportDate: string;
    managerName: string;
    meta?: {
      asOf?: string;
      weekPeriod?: string;
      weekInPeriod?: boolean;
    } | null;
    stats: {
      total: number;
      resolved: number;
      incomplete: number;
      partial: number;
      notResolved: number;
      active: number;
    };
    tasks: Array<{
      key: string;
      taskType: string;
      nomenclature: string;
      problem: string;
      solution: string;
      priority: string;
      deadline: string;
      deficit: string;
      status: string;
      resultText: string;
      evalComment?: string;
      reason?: string;
    }>;
    incompleteReasons: Record<string, string>;
  }) =>
    apiClient
      .post<{
        ok: boolean;
        id: string;
        sent_to: string;
        email_sent_at?: string | null;
      }>("/agents/document-analysis/shift-assignment/complete", {
        report_date: payload.reportDate,
        manager_name: payload.managerName,
        meta: payload.meta
          ? {
              as_of: payload.meta.asOf,
              week_period: payload.meta.weekPeriod,
              week_in_period: payload.meta.weekInPeriod
            }
          : null,
        stats: payload.stats,
        tasks: payload.tasks.map((task) => ({
          key: task.key,
          task_type: task.taskType,
          nomenclature: task.nomenclature,
          problem: task.problem,
          solution: task.solution,
          priority: task.priority,
          deadline: task.deadline,
          deficit: task.deficit,
          status: task.status,
          result_text: task.resultText,
          eval_comment: task.evalComment,
          reason: task.reason
        })),
        incomplete_reasons: payload.incompleteReasons
      })
      .then((r) => r.data),

  getShiftCompletionDashboard: (params?: { reportDate?: string }) =>
    apiClient
      .get<{
        ok: boolean;
        report_date: string;
        summary: {
          total: number;
          resolved: number;
          incomplete: number;
          partial: number;
          not_resolved: number;
          active: number;
          resolved_percent: number;
        };
        roster: {
          total: number;
          submitted: number;
          in_progress?: number;
          missing: number;
        };
        live_mode?: boolean;
        managers: Array<{
          id: string;
          manager_name: string;
          report_date: string;
          report_status: "submitted" | "missing" | "in_progress";
          region_label: string;
          stats: {
            total: number;
            resolved: number;
            incomplete: number;
            partial: number;
            not_resolved: number;
            active: number;
            resolved_percent: number;
          };
          tasks: Array<Record<string, unknown>>;
          incomplete_tasks: Array<Record<string, unknown>>;
          email_sent_to: string;
          email_sent_at?: string | null;
          live_updated_at?: string | null;
        }>;
      }>("/agents/document-analysis/shift-assignment/completion-dashboard", {
        params: params?.reportDate ? { report_date: params.reportDate } : undefined
      })
      .then((r) => ({
        reportDate: r.data.report_date,
        liveMode: Boolean(r.data.live_mode),
        roster: {
          total: r.data.roster?.total ?? r.data.managers?.length ?? 0,
          submitted: r.data.roster?.submitted ?? 0,
          inProgress: r.data.roster?.in_progress ?? 0,
          missing: r.data.roster?.missing ?? 0
        },
        summary: {
          total: r.data.summary.total ?? 0,
          resolved: r.data.summary.resolved ?? 0,
          incomplete: r.data.summary.incomplete ?? 0,
          partial: r.data.summary.partial ?? 0,
          notResolved: r.data.summary.not_resolved ?? 0,
          active: r.data.summary.active ?? 0,
          resolvedPercent: r.data.summary.resolved_percent ?? 0
        },
        managers: (r.data.managers ?? []).map((manager) => ({
          id: manager.id,
          managerName: manager.manager_name,
          reportDate: manager.report_date,
          reportStatus: manager.report_status ?? "submitted",
          regionLabel: manager.region_label ?? "",
          stats: {
            total: manager.stats.total ?? 0,
            resolved: manager.stats.resolved ?? 0,
            incomplete: manager.stats.incomplete ?? 0,
            partial: manager.stats.partial ?? 0,
            notResolved: manager.stats.not_resolved ?? 0,
            active: manager.stats.active ?? 0,
            resolvedPercent: manager.stats.resolved_percent ?? 0
          },
          tasks: manager.tasks ?? [],
          incompleteTasks: manager.incomplete_tasks ?? [],
          emailSentTo: manager.email_sent_to,
          emailSentAt: manager.email_sent_at ?? null,
          liveUpdatedAt: manager.live_updated_at ?? null
        }))
      })),

  getShiftCompletionDates: () =>
    apiClient
      .get<{
        ok: boolean;
        today: string;
        roster_total?: number;
        dates: Array<{
          report_date: string;
          reports_count: number;
          roster_total?: number;
          has_live?: boolean;
        }>;
      }>("/agents/document-analysis/shift-assignment/completion-dates")
      .then((r) => ({
        today: r.data.today,
        rosterTotal: r.data.roster_total ?? 2,
        dates: (r.data.dates ?? []).map((entry) => ({
          reportDate: entry.report_date,
          reportsCount: entry.reports_count ?? 0,
          rosterTotal: entry.roster_total ?? r.data.roster_total ?? 2,
          hasLive: Boolean(entry.has_live)
        }))
      }))
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
    only_info_to_test_ii?: boolean;
  }) =>
    pochtaApiClient.get<EmailMessagesPage>("/api/v1/email-messages", { params }).then((r) => r.data),
  stats: (params?: { date_from?: string; date_to?: string; q?: string; only_info_to_test_ii?: boolean }) =>
    pochtaApiClient.get<EmailMessagesStats>("/api/v1/email-messages/stats", { params }).then((r) => r.data),
  get: (messageRowId: string) =>
    pochtaApiClient.get<EmailMessage>(`/api/v1/email-messages/${messageRowId}`).then((r) => r.data),
  fetchBody: (messageRowId: string) =>
    pochtaApiClient
      .post<EmailMessageFetchBodyResponse>(`/api/v1/email-messages/${messageRowId}/fetch-body`, null, {
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
  resolveHuman: (
    messageRowId: string,
    body: {
      decision: "approve_routing" | "mark_spam" | "mark_not_spam";
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
      .then((r) => r.data)
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
