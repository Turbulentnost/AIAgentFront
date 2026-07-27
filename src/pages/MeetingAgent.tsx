import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  History,
  Loader2,
  MapPin,
  Presentation,
  RefreshCw,
  UserCog,
  UserRound,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  formatMeetingIntegrationError,
  getMeetingMemoActionError,
  getMeetingRequestError,
  isMeetingDashboardForbidden,
  useMeetingDashboard,
  useMeetingPermissions,
  useRefreshMeetingDashboard
} from "@/hooks/useMeetingDashboard";
import {
  useCreateMeetingRun,
  useMeetingAgentSlotApprove,
  useMeetingAgentSlotPreview,
  useMeetingAgentSlotPreviewDetails,
  useMeetingMemoApprove,
  useMeetingMemoDetail,
  useMeetingMemoCreateSeries,
  useMeetingMemoReject,
  useMeetingMemoSeriesPlanningChoice,
  useMeetingRunResult
} from "@/hooks/useMeetingMemoDetail";
import { meetingScheduleQueryKey } from "@/hooks/useMeetingSchedule";
import MeetingAgentRegistry from "@/pages/MeetingAgentRegistry";
import MeetingAgentSchedule from "@/pages/MeetingAgentSchedule";
import MeetingAgentRejectModal from "@/pages/MeetingAgentRejectModal";
import MeetingAgentSeriesConfirmModal from "@/pages/MeetingAgentSeriesConfirmModal";
import MeetingAgentSlotPreviewModal from "@/pages/MeetingAgentSlotPreviewModal";
import MeetingAgentTopicModal from "@/pages/MeetingAgentTopicModal";
import type {
  MeetingDashboardItem,
  MeetingMemoDetail,
  MeetingTopicResolveRead
} from "@/types/meetings";
import {
  buildMeetingStats,
  buildMeetingQueueFilterCounts,
  canShowMeetingMemoDecisionActions,
  countPassedStoChecklist,
  filterMeetingQueueItems,
  getMeetingQueueEmptyMessage,
  meetingQueueFilters,
  formatMeetingDate,
  formatMeetingDateTime,
  getMeetingItemCode,
  getMeetingItemId,
  getMeetingPersonName,
  getMeetingScheduledLabel,
  getMeetingTheme,
  getMeetingParticipantNames,
  getMeetingStatusLabel,
  getMeetingStatusTone,
  isMeetingPsdLevel,
  getMemoRefKey,
  isMeetingRunActive,
  isMeetingSlotPreviewAssignable,
  normalizeOutlookMeetingUrl,
  resolveMeetingSlotPreview,
  type MeetingQueueFilter
} from "@/utils/meetingDashboard";
import {
  buildMeetingTopicCheckPayload,
  buildMeetingTopicRequestPayload,
  formatResolvedMeetingTopicLabel,
  resetMeetingTopicResolutionCache,
  resolveMeetingSubjectFromTopic,
  resolveMeetingTypeFromTopic,
  saveMeetingTopicResolution,
  validateStoredMeetingTopicResolution,
  type MeetingTopicPendingAction
} from "@/utils/meetingTopic";
import { meetingsApi } from "@/api/endpoints";
import { isRequestAborted } from "@/utils/requestAbort";
import styles from "./MeetingAgent.module.css";

type MeetingPageTab = "queue" | "registry" | "schedule";

class MeetingAgentErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <section className={styles.page}>
          <div className={styles.stateMessage} role="alert">
            Не удалось отобразить страницу агента совещаний.
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => this.setState({ error: null })}
            >
              Повторить
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

function MeetingAgentPage() {
  const queryClient = useQueryClient();
  const permissionsQuery = useMeetingPermissions();
  const canAccessAgent = permissionsQuery.data?.can_access_agent ?? false;
  const [pageTab, setPageTab] = useState<MeetingPageTab>("registry");
  const isQueueTab = pageTab === "queue";

  const dashboardQuery = useMeetingDashboard(canAccessAgent && isQueueTab);
  const refreshDashboard = useRefreshMeetingDashboard();
  const [queueFilter, setQueueFilter] = useState<MeetingQueueFilter>("unapproved");
  const [selectedId, setSelectedId] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [forceMemoRefresh, setForceMemoRefresh] = useState(false);
  const [slotPreviewOpen, setSlotPreviewOpen] = useState(false);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const slotPreviewAbortRef = useRef<AbortController | null>(null);
  const slotDetailsAbortRef = useRef<AbortController | null>(null);
  const [topicPendingAction, setTopicPendingAction] = useState<MeetingTopicPendingAction | null>(null);
  const [resolvedTopic, setResolvedTopic] = useState<MeetingTopicResolveRead | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [outlookMeetingUrl, setOutlookMeetingUrl] = useState<string | null>(null);
  const [scheduleHighlightId, setScheduleHighlightId] = useState<string | null>(null);
  const [seriesPlanningError, setSeriesPlanningError] = useState<string | null>(null);
  const [seriesConfirmModalOpen, setSeriesConfirmModalOpen] = useState(false);

  const dashboard = dashboardQuery.data;
  const queueItems = useMemo(
    () => (dashboard ? filterMeetingQueueItems(dashboard, queueFilter) : []),
    [dashboard, queueFilter]
  );
  const queueFilterCounts = useMemo(
    () => (dashboard ? buildMeetingQueueFilterCounts(dashboard) : null),
    [dashboard]
  );
  const stats = useMemo(() => (dashboard ? buildMeetingStats(dashboard) : []), [dashboard]);

  const selectedItem =
    queueItems.find((item) => getMeetingItemId(item) === selectedId) ?? queueItems[0] ?? null;
  const selectedRefKey = getMemoRefKey(selectedItem);

  const detailQuery = useMeetingMemoDetail(
    selectedRefKey,
    canAccessAgent && isQueueTab,
    forceMemoRefresh
  );
  const detail = detailQuery.data;

  const createRun = useCreateMeetingRun();
  const slotPreviewMutation = useMeetingAgentSlotPreview();
  const slotPreviewDetailsMutation = useMeetingAgentSlotPreviewDetails();
  const approveSlotMutation = useMeetingAgentSlotApprove();
  const approveMemoMutation = useMeetingMemoApprove();
  const rejectMemoMutation = useMeetingMemoReject();
  const seriesChoiceMutation = useMeetingMemoSeriesPlanningChoice();
  const createSeriesMutation = useMeetingMemoCreateSeries();
  const runQuery = useMeetingRunResult(activeRunId);

  useEffect(() => {
    if (!isQueueTab) return;
    resetMeetingTopicResolutionCache();
  }, [isQueueTab]);

  useEffect(() => {
    if (!queueItems.length) {
      setSelectedId("");
      return;
    }
    if (!queueItems.some((item) => getMeetingItemId(item) === selectedId)) {
      setSelectedId(getMeetingItemId(queueItems[0]));
    }
  }, [queueItems, selectedId]);

  useEffect(() => {
    setActiveRunId(null);
    setForceMemoRefresh(false);
    setTopicPendingAction(null);
    setTopicModalOpen(false);
    setResolvedTopic(null);

    if (!selectedRefKey) return;
    let cancelled = false;
    void validateStoredMeetingTopicResolution(selectedRefKey).then((stored) => {
      if (!cancelled) {
        setResolvedTopic(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRefKey]);

  useEffect(() => {
    if (!detail || !selectedItem || forceMemoRefresh || detailQuery.isFetching) return;

    const application = detail.application;
    if (!application) return;

    const participantNames = getMeetingParticipantNames(application, selectedItem);
    const participantsCount = Math.max(
      application.participants_count ?? 0,
      selectedItem.participants_count ?? 0
    );

    if (participantsCount > 0 && participantNames.length === 0) {
      setForceMemoRefresh(true);
    }
  }, [detail, detailQuery.isFetching, forceMemoRefresh, selectedItem]);

  async function handleRefreshDashboard() {
    if (isRefreshing) return;
    setRefreshError(null);
    setIsRefreshing(true);
    try {
      await refreshDashboard();
      // Карточка СЗ читается из Redis-снимка; после refresh очереди
      // принудительно перечитываем выбранную СЗ из 1С.
      setForceMemoRefresh(true);
    } catch (error) {
      setRefreshError(getMeetingRequestError(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  const isDashboardFetching = dashboardQuery.isFetching || isRefreshing;

  async function handleSeriesPlanningChoice(mode: "series" | "single") {
    if (!detail?.ref_key) return;
    setSeriesPlanningError(null);

    if (mode === "single") {
      try {
        await seriesChoiceMutation.mutateAsync({ memoRefKey: detail.ref_key, mode: "single" });
        await detailQuery.refetch();
      } catch (error) {
        setSeriesPlanningError(getMeetingMemoActionError(error));
      }
      return;
    }

    void ensureTopicWorkflow("series", openSeriesConfirmModal);
  }

  function openSeriesConfirmModal() {
    setSeriesConfirmModalOpen(true);
    setSeriesPlanningError(null);
  }

  async function handleConfirmSeriesPlanning() {
    if (!detail?.ref_key) return;
    setSeriesPlanningError(null);

    try {
      const created = await createSeriesMutation.mutateAsync({
        memoRefKey: detail.ref_key,
        payload: {
          meeting_topic: buildMeetingTopicRequestPayload(resolvedTopic) ?? null
        }
      });
      setSeriesConfirmModalOpen(false);
      setScheduleHighlightId(created.scheduled_meeting_id);
      setPageTab("schedule");
      const parts = [
        `Серия «${created.scheduled_meeting_title}» сохранена в графике`,
        created.recurrence_label ? `(${created.recurrence_label})` : null,
        created.memo_approved ? "СЗ согласована" : created.memo_approve_message
      ].filter(Boolean);
      setSuccessMessage(`${parts.join(". ")}. Распланируйте серию в Outlook на вкладке «График совещаний».`);
      await Promise.all([
        detailQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["meetings", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: meetingScheduleQueryKey })
      ]);
    } catch (error) {
      setSeriesPlanningError(getMeetingMemoActionError(error));
    }
  }

  function handleCloseSeriesConfirmModal() {
    if (createSeriesMutation.isPending) return;
    setSeriesConfirmModalOpen(false);
    setSeriesPlanningError(null);
    createSeriesMutation.reset();
  }

  if (permissionsQuery.isLoading) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>Проверяем доступ…</div>
      </section>
    );
  }

  if (!permissionsQuery.data?.can_access_agent) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>
          Нет доступа к агенту совещаний. Раздел доступен сотрудникам Управления делами.
        </div>
      </section>
    );
  }

  async function handleRunAgent() {
    if (!detail?.ref_key) return;
    const run = await createRun.mutateAsync({
      memo_ref_key: detail.ref_key,
      memo_number: detail.number,
      title: detail.number ? `СЗ №${detail.number}` : "Анализ заявки на совещание"
    });
    setActiveRunId(run.task_id);
  }

  async function performApproveMemo() {
    if (!detail?.ref_key || approveMemoMutation.isPending) return;

    setSuccessMessage(null);
    setOutlookMeetingUrl(null);
    approveMemoMutation.reset();
    try {
      const result = await approveMemoMutation.mutateAsync({
        memoRefKey: detail.ref_key
      });
      setSuccessMessage(
        result.message?.trim() || (
          result.already_approved
            ? `${result.number ? `СЗ №${result.number}` : "Служебная записка"} уже согласована`
            : `${result.number ? `СЗ №${result.number}` : "Служебная записка"} согласована`
        )
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["meetings", "memo-detail", detail.ref_key] })
      ]);
    } catch {
      // error surfaced in MeetingDetails
    }
  }

  function shouldRunTopicWorkflow(): boolean {
    if (!detail) return false;
    return buildMeetingTopicCheckPayload(detail, selectedItem) != null;
  }

  async function ensureTopicWorkflow(
    action: MeetingTopicPendingAction,
    proceed: () => void | Promise<void>
  ) {
    if (!detail?.ref_key || topicModalOpen) return;

    if (!shouldRunTopicWorkflow()) {
      await proceed();
      return;
    }

    const stored = await validateStoredMeetingTopicResolution(detail.ref_key);
    if (stored) {
      setResolvedTopic(stored);
      await proceed();
      return;
    }

    setSuccessMessage(null);
    setOutlookMeetingUrl(null);
    setTopicPendingAction(action);
    setTopicModalOpen(true);
  }

  async function startSlotPreview() {
    if (!detail?.ref_key) return;
    slotPreviewAbortRef.current?.abort();
    const controller = new AbortController();
    slotPreviewAbortRef.current = controller;
    setSlotPreviewOpen(true);
    slotPreviewMutation.reset();
    try {
      await slotPreviewMutation.mutateAsync({
        memoRefKey: detail.ref_key,
        durationMinutes: detail.application.duration_minutes,
        signal: controller.signal
      });
    } catch (error) {
      if (isRequestAborted(error, controller.signal)) return;
      // mutation error surfaced in modal
    }
  }

  function handleLaunchAgent() {
    if (!detail?.ref_key || topicModalOpen) return;
    if (slotPreviewOpen && slotPreviewMutation.isPending) return;
    approveSlotMutation.reset();
    approveMemoMutation.reset();
    slotPreviewMutation.reset();
    void ensureTopicWorkflow("slot", startSlotPreview);
  }

  function handleCloseTopicModal() {
    if (approveMemoMutation.isPending) return;
    setTopicModalOpen(false);
    setTopicPendingAction(null);
  }

  async function handleTopicResolved(result: MeetingTopicResolveRead) {
    if (!detail?.ref_key) return;

    saveMeetingTopicResolution(detail.ref_key, result);
    setResolvedTopic(result);
    setTopicModalOpen(false);

    try {
      await meetingsApi.saveRegistryMeetingTopic(detail.ref_key, result);
    } catch {
      // Карточка реестра может ещё не существовать до отправки приглашения.
    }

    const pendingAction = topicPendingAction;
    setTopicPendingAction(null);

    if (pendingAction === "approve") {
      await performApproveMemo();
      return;
    }

    if (pendingAction === "slot") {
      await startSlotPreview();
      return;
    }

    if (pendingAction === "series") {
      openSeriesConfirmModal();
    }
  }

  function handleCloseSlotPreview() {
    if (approveSlotMutation.isPending || approveMemoMutation.isPending) return;
    slotPreviewAbortRef.current?.abort();
    slotDetailsAbortRef.current?.abort();
    setSlotPreviewOpen(false);
    slotPreviewMutation.reset();
    slotPreviewDetailsMutation.reset();
    approveSlotMutation.reset();
    approveMemoMutation.reset();
  }

  const handleFetchSlotDetails = useCallback(
    async (slotStart: string, slotEnd: string) => {
      if (!detail?.ref_key) {
        throw new Error("У заявки нет ref_key для загрузки деталей слота.");
      }
      slotDetailsAbortRef.current?.abort();
      const controller = new AbortController();
      slotDetailsAbortRef.current = controller;
      const durationMinutes = slotPreviewMutation.data?.duration_minutes ?? undefined;
      const availabilityCacheId = slotPreviewMutation.data?.availability_cache_id ?? undefined;
      return slotPreviewDetailsMutation.mutateAsync({
        memoRefKey: detail.ref_key,
        payload: {
          slot_start: slotStart,
          slot_end: slotEnd,
          ...(durationMinutes ? { duration_minutes: durationMinutes } : {}),
          ...(availabilityCacheId ? { availability_cache_id: availabilityCacheId } : {})
        },
        signal: controller.signal
      });
    },
    [
      detail?.ref_key,
      slotPreviewDetailsMutation,
      slotPreviewMutation.data?.duration_minutes,
      slotPreviewMutation.data?.availability_cache_id
    ]
  );

  async function handleConfirmApprove(
    slotOverride?: { start: string; end: string },
    slotDetails?: import("@/types/meetings").MeetingAgentSlotPreviewDetails | null
  ) {
    const preview = slotPreviewMutation.data;
    if (!preview || (!isMeetingSlotPreviewAssignable(preview) && !slotOverride)) return;
    const slot = slotOverride ?? resolveMeetingSlotPreview(preview);
    const shouldApproveMemoFirst = queueFilter === "unapproved";
    if (
      !detail?.ref_key ||
      !preview ||
      !slot ||
      approveSlotMutation.isPending ||
      approveMemoMutation.isPending
    ) {
      return;
    }

    approveSlotMutation.reset();
    approveMemoMutation.reset();
    try {
      let memoMessage: string | null = null;
      if (shouldApproveMemoFirst) {
        const memoResult = await approveMemoMutation.mutateAsync({
          memoRefKey: detail.ref_key
        });
        memoMessage = memoResult.message?.trim() || null;
      }

      const result = await approveSlotMutation.mutateAsync({
        memoRefKey: detail.ref_key,
        payload: {
          slot_start: slot.start,
          slot_end: slot.end,
          subject: resolveMeetingSubjectFromTopic(detail, resolvedTopic),
          location:
            detail.application.invite_location ||
            detail.application.location ||
            undefined,
          attendees: preview.attendees,
          participants: slotDetails?.participants,
          company_calendar_cache_id: slotDetails?.company_calendar_cache_id,
          reschedule_message: slotDetails?.requires_reschedule
            ? "Встреча перенесена для освобождения слота по служебной записке"
            : undefined,
          meeting_topic: buildMeetingTopicRequestPayload(resolvedTopic)
        }
      });
      setSlotPreviewOpen(false);
      slotPreviewMutation.reset();
      approveSlotMutation.reset();
      approveMemoMutation.reset();

      const slotMessage = result.sent
        ? `Приглашение отправлено: ${result.slot_label}${result.subject ? ` · ${result.subject}` : ""}${
            result.rescheduled_events?.length
              ? ` · перенесено: ${result.rescheduled_events.join(", ")}`
              : ""
          }`
        : `Слот утверждён: ${result.slot_label}`;
      setSuccessMessage(memoMessage ? `${memoMessage} · ${slotMessage}` : slotMessage);
      setOutlookMeetingUrl(normalizeOutlookMeetingUrl(result.outlook_meeting_url));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["meetings", "memo-detail", detail.ref_key] }),
        queryClient.invalidateQueries({ queryKey: ["meetings", "registry"] })
      ]);
    } catch {
      // error surfaced in modal
    }
  }

  function handleApproveMemo() {
    if (!detail?.ref_key || approveMemoMutation.isPending || topicModalOpen) return;
    void ensureTopicWorkflow("approve", performApproveMemo);
  }

  function handleOpenRejectModal() {
    if (!detail?.ref_key || rejectMemoMutation.isPending) return;
    setSuccessMessage(null);
    setOutlookMeetingUrl(null);
    rejectMemoMutation.reset();
    setRejectModalOpen(true);
  }

  function handleCloseRejectModal() {
    if (rejectMemoMutation.isPending) return;
    setRejectModalOpen(false);
    rejectMemoMutation.reset();
  }

  async function handleConfirmReject(payload: { reason: string; notifyInitiator: boolean }) {
    if (!detail?.ref_key || rejectMemoMutation.isPending) return;

    rejectMemoMutation.reset();
    try {
      const result = await rejectMemoMutation.mutateAsync({
        memoRefKey: detail.ref_key,
        payload: {
          reason: payload.reason,
          notify_initiator: payload.notifyInitiator
        }
      });
      setRejectModalOpen(false);
      rejectMemoMutation.reset();

      setOutlookMeetingUrl(null);
      setSuccessMessage(result.message?.trim() || (
        result.already_rejected
          ? `${result.number ? `СЗ №${result.number}` : "Служебная записка"} уже была отклонена`
          : `${result.number ? `СЗ №${result.number}` : "Служебная записка"} отклонена${
              result.notification_sent ? " · инициатор уведомлён" : ""
            }`
      ));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["meetings", "memo-detail", detail.ref_key] })
      ]);
    } catch {
      // mutation error surfaced in modal
    }
  }

  const slotPreviewRequestError =
    slotPreviewOpen &&
    slotPreviewMutation.isError &&
    !isRequestAborted(slotPreviewMutation.error)
    ? getMeetingRequestError(slotPreviewMutation.error)
    : null;

  const approveRequestError = approveMemoMutation.isError
    ? getMeetingMemoActionError(approveMemoMutation.error)
    : approveSlotMutation.isError
      ? getMeetingRequestError(approveSlotMutation.error)
      : null;

  const rejectRequestError = rejectMemoMutation.isError
    ? getMeetingMemoActionError(rejectMemoMutation.error)
    : null;

  const approveMemoError = approveMemoMutation.isError
    ? getMeetingMemoActionError(approveMemoMutation.error)
    : null;

  const rejectMemoLabel = detail?.number
    ? `СЗ №${detail.number}${detail.title ? ` · ${detail.title}` : ""}`
    : detail?.title || "Служебная записка";

  const recommendation =
    detail?.agent_recommendation ||
    runQuery.data?.summary ||
    "Откройте заявку для проверки условий СТО.";

  return (
    <section className={styles.page} aria-labelledby="meeting-agent-title">
      {detail ? (
        <MeetingAgentTopicModal
          mode="memo"
          open={topicModalOpen}
          detail={detail}
          queueItem={selectedItem}
          onClose={handleCloseTopicModal}
          onResolved={(result) => void handleTopicResolved(result)}
        />
      ) : null}
      <MeetingAgentSlotPreviewModal
        open={slotPreviewOpen}
        loading={slotPreviewOpen && slotPreviewMutation.isPending}
        preview={slotPreviewMutation.data ?? null}
        requestError={slotPreviewRequestError}
        approveError={approveRequestError}
        onClose={handleCloseSlotPreview}
        onConfirmApprove={(slotOverride) => void handleConfirmApprove(slotOverride)}
        isApproving={approveSlotMutation.isPending || approveMemoMutation.isPending}
        approveWithMemo={queueFilter === "unapproved"}
        onFetchSlotDetails={handleFetchSlotDetails}
      />
      <MeetingAgentRejectModal
        open={rejectModalOpen}
        memoLabel={rejectMemoLabel}
        loading={rejectMemoMutation.isPending}
        error={rejectRequestError}
        onClose={handleCloseRejectModal}
        onConfirm={(payload) => void handleConfirmReject(payload)}
      />
      {detail?.series_planning ? (
        <MeetingAgentSeriesConfirmModal
          open={seriesConfirmModalOpen}
          memoLabel={detail.number ? `СЗ №${detail.number}` : "Служебная записка"}
          planning={detail.series_planning}
          resolvedTopicLabel={formatResolvedMeetingTopicLabel(resolvedTopic)}
          loading={createSeriesMutation.isPending}
          error={seriesPlanningError}
          onClose={handleCloseSeriesConfirmModal}
          onConfirm={() => void handleConfirmSeriesPlanning()}
        />
      ) : null}
      {successMessage ? (
        <div className={styles.successBanner} role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span className={styles.successBannerText}>{successMessage}</span>
          {outlookMeetingUrl ? (
            <a
              className={styles.successBannerOutlookButton}
              href={outlookMeetingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Открыть в Outlook
            </a>
          ) : null}
        </div>
      ) : null}
      {refreshError ? (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{refreshError}</span>
        </div>
      ) : null}

      {dashboard?.error && isQueueTab ? (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{formatMeetingIntegrationError(dashboard.error)}</span>
        </div>
      ) : null}

      <div className={styles.pageTabs} role="tablist" aria-label="Разделы агента совещаний">
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "registry"}
          className={`${styles.pageTab} ${pageTab === "registry" ? styles.pageTabActive : ""}`}
          onClick={() => setPageTab("registry")}
        >
          Реестр совещаний
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "queue"}
          className={`${styles.pageTab} ${pageTab === "queue" ? styles.pageTabActive : ""}`}
          onClick={() => setPageTab("queue")}
        >
          Рабочая очередь
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "schedule"}
          className={`${styles.pageTab} ${pageTab === "schedule" ? styles.pageTabActive : ""}`}
          onClick={() => setPageTab("schedule")}
        >
          График совещаний
        </button>
      </div>

      {pageTab === "registry" ? (
        <MeetingAgentRegistry canAccessAgent={canAccessAgent} />
      ) : pageTab === "schedule" ? (
        <MeetingAgentSchedule
          canAccessAgent={canAccessAgent}
          initialSelectedId={scheduleHighlightId}
        />
      ) : !dashboard ? (
        <div className={styles.stateMessage}>
          {dashboardQuery.isError && isMeetingDashboardForbidden(dashboardQuery.error)
            ? "Нет доступа к данным по совещаниям."
            : dashboardQuery.isError
              ? (
                <>
                  Не удалось загрузить данные по совещаниям.
                  <button
                    type="button"
                    className={styles.retryButton}
                    onClick={() => void dashboardQuery.refetch()}
                  >
                    Повторить
                  </button>
                </>
              )
              : dashboardQuery.isLoading
                ? "Загружаем рабочую очередь…"
                : "Нет данных по совещаниям."}
        </div>
      ) : (
        <>
      <div className={styles.statsRow} aria-label="Сводка по заявкам">
        {stats.map((stat) => (
          <article className={styles.statCard} key={stat.id}>
            <strong className={styles[`statValue${stat.tone}`]}>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>

      <div className={styles.workspace}>
        <aside className={styles.queuePanel} aria-labelledby="meeting-queue-title">
          <div className={styles.panelHead}>
            <h2 id="meeting-queue-title">Рабочая очередь</h2>
            <button
              type="button"
              className={`${styles.refreshButton} ${isDashboardFetching ? styles.refreshButtonSpinning : ""}`}
              onClick={() => void handleRefreshDashboard()}
              disabled={isDashboardFetching}
              aria-label="Обновить очередь"
            >
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.queueTabs} role="tablist" aria-label="Фильтр заявок">
            {meetingQueueFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={queueFilter === filter.id}
                className={`${styles.queueTab} ${queueFilter === filter.id ? styles.queueTabActive : ""}`}
                onClick={() => setQueueFilter(filter.id)}
              >
                {filter.label} — {queueFilterCounts?.[filter.id] ?? 0}
              </button>
            ))}
          </div>

          <div className={styles.queueList}>
            {queueItems.length ? (
              queueItems.map((item) => (
                <QueueCard
                  key={getMeetingItemId(item)}
                  item={item}
                  active={selectedId === getMeetingItemId(item)}
                  onSelect={() => setSelectedId(getMeetingItemId(item))}
                />
              ))
            ) : (
              <div className={styles.queueEmpty}>{getMeetingQueueEmptyMessage(queueFilter)}</div>
            )}
          </div>

          <p className={styles.queueMetaNote}>
            Обновлено: {formatMeetingDateTime(dashboard.fetched_at)} · Дата: {formatMeetingDate(dashboard.date)}
          </p>
        </aside>

        <section className={styles.detailsPanel} aria-labelledby="meeting-details-title">
          {!selectedItem ? (
            <div className={styles.detailsEmpty}>Выберите заявку из рабочей очереди</div>
          ) : !selectedRefKey ? (
            <div className={styles.detailsEmpty}>У заявки нет ref_key для загрузки деталей</div>
          ) : detailQuery.isLoading && !detail ? (
            <div className={styles.detailsEmpty}>Загружаем карточку заявки…</div>
          ) : detailQuery.isError ? (
            <div className={styles.detailsEmpty}>
              Не удалось загрузить детали заявки.
              <button type="button" className={styles.retryButton} onClick={() => detailQuery.refetch()}>
                Повторить
              </button>
            </div>
          ) : detail ? (
            <MeetingDetails
              detail={detail}
              queueItem={selectedItem}
              recommendation={recommendation}
              runStatus={runQuery.data?.status ?? createRun.data?.status}
              runError={runQuery.data?.error_message}
              isRunning={
                createRun.isPending ||
                isMeetingRunActive(runQuery.data?.status) ||
                topicModalOpen ||
                (slotPreviewOpen && slotPreviewMutation.isPending) ||
                rejectMemoMutation.isPending ||
                approveMemoMutation.isPending ||
                seriesChoiceMutation.isPending ||
                createSeriesMutation.isPending
              }
              isRejecting={rejectMemoMutation.isPending}
              isApproving={approveMemoMutation.isPending}
              approveError={approveMemoError}
              seriesPlanningError={seriesPlanningError}
              isSeriesPlanningPending={
                seriesChoiceMutation.isPending || createSeriesMutation.isPending
              }
              onSeriesPlanningChoice={(mode) => void handleSeriesPlanningChoice(mode)}
              onLaunchAgent={() => void handleLaunchAgent()}
              onAutoApprove={() => void handleApproveMemo()}
              onReject={() => handleOpenRejectModal()}
              isTopicChecking={topicModalOpen}
              topicPendingAction={topicPendingAction}
              resolvedTopic={resolvedTopic}
            />
          ) : null}
        </section>
      </div>
        </>
      )}
    </section>
  );
}

function QueueCard({
  item,
  active,
  onSelect
}: {
  item: MeetingDashboardItem;
  active: boolean;
  onSelect: () => void;
}) {
  const statusLabel = getMeetingStatusLabel(item.status, item.status_label);
  const statusTone = getMeetingStatusTone(item.status);

  return (
    <button
      type="button"
      className={`${styles.queueCard} ${active ? styles.queueCardActive : ""}`}
      onClick={onSelect}
    >
      <div className={styles.queueCardHeader}>
        <strong className={styles.queueCardCode}>{getMeetingItemCode(item)}</strong>
        <div className={styles.queueCardBadges}>
          <span className={`${styles.queueCardStatus} ${styles[`queueCardStatus${statusTone}`]}`}>
            {statusLabel}
          </span>
          {isMeetingPsdLevel(item) ? (
            <span className={styles.queueCardPsdBadge}>ПСД</span>
          ) : null}
          {item.series_detected ? (
            <span className={styles.queueCardSeriesBadge} title={item.series_recurrence_label ?? undefined}>
              Серия
            </span>
          ) : null}
        </div>
      </div>

      <p className={styles.queueCardTheme}>{getMeetingTheme(item)}</p>

      <dl className={styles.queueCardFields}>
        <div>
          <dt>Дата СЗ</dt>
          <dd>{formatMeetingDateTime(item.document_date)}</dd>
        </div>
        <div>
          <dt>Дата совещания</dt>
          <dd>{getMeetingScheduledLabel(item)}</dd>
        </div>
        <div>
          <dt>Инициатор</dt>
          <dd className={styles.queueCardFieldPerson}>
            {getMeetingPersonName(item.initiator, { short: true })}
          </dd>
        </div>
        <div>
          <dt>Руководитель</dt>
          <dd className={styles.queueCardFieldPerson}>
            {getMeetingPersonName(item.manager, { short: true })}
          </dd>
        </div>
      </dl>
    </button>
  );
}

function DataField({
  label,
  icon: Icon,
  value,
  className
}: {
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd className={styles.dataFieldValue}>
        <Icon size={14} className={styles.dataFieldIcon} aria-hidden="true" />
        <span>{value}</span>
      </dd>
    </div>
  );
}

function MeetingDetails({
  detail,
  queueItem,
  recommendation,
  runStatus,
  runError,
  isRunning,
  isRejecting = false,
  isApproving = false,
  approveError,
  seriesPlanningError,
  isSeriesPlanningPending = false,
  onSeriesPlanningChoice,
  onLaunchAgent,
  onAutoApprove,
  onReject,
  isTopicChecking = false,
  topicPendingAction = null,
  resolvedTopic = null
}: {
  detail: MeetingMemoDetail;
  queueItem: MeetingDashboardItem | null;
  recommendation: string;
  runStatus?: string;
  runError?: string | null;
  isRunning: boolean;
  isRejecting?: boolean;
  isApproving?: boolean;
  approveError?: string | null;
  seriesPlanningError?: string | null;
  isSeriesPlanningPending?: boolean;
  onSeriesPlanningChoice?: (mode: "series" | "single") => void;
  onLaunchAgent: () => void;
  onAutoApprove?: () => void;
  onReject?: () => void;
  isTopicChecking?: boolean;
  topicPendingAction?: MeetingTopicPendingAction | null;
  resolvedTopic?: MeetingTopicResolveRead | null;
}) {
  const application = detail.application;
  const participantNames = getMeetingParticipantNames(application, queueItem);
  const stoChecklist = detail.sto_checklist ?? [];
  const stoPassedCount = countPassedStoChecklist(detail);
  const seriesPlanning = detail.series_planning;
  const selectedSeriesMode = seriesPlanning?.selected_mode ?? null;
  const canPlanAsSeries = seriesPlanning?.planning_options.includes("series") ?? false;
  const showSeriesPlanning =
    Boolean(seriesPlanning?.detected) && selectedSeriesMode !== "single";
  const isSingleSeriesMode = selectedSeriesMode === "single";
  const isSeriesMode = selectedSeriesMode === "series";
  const visibleStatus = getMeetingStatusLabel(
    queueItem?.status ?? detail.status,
    queueItem?.status_label ?? detail.status_label
  );
  const canShowDecisionActions = canShowMeetingMemoDecisionActions(detail, queueItem);

  return (
    <>
      <header className={styles.detailsHead}>
        <div>
          <h2 id="meeting-details-title">
            {detail.number ? `СЗ №${detail.number}` : "Служебная записка"} · {detail.title || "Заявка на совещание"}
          </h2>
        </div>
        <span className={styles.statusBadge}>{visibleStatus}</span>
      </header>

      <div className={styles.section}>
        <h3>Данные заявки</h3>
        <dl className={styles.dataGrid}>
          <DataField
            label="Инициатор"
            icon={UserRound}
            value={application.initiator?.full_name ?? "—"}
          />
          <DataField
            label="Руководитель"
            icon={UserCog}
            value={application.manager?.full_name ?? "—"}
          />
          <div className={styles.participantsField}>
            <dt>Участники</dt>
            <dd>
              {participantNames.length ? (
                <ul className={styles.participantList}>
                  {participantNames.map((name) => (
                    <li className={styles.participantListItem} key={name}>
                      <Users size={14} className={styles.participantListIcon} aria-hidden="true" />
                      <span>{name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={styles.dataFieldValue}>
                  <Users size={14} className={styles.dataFieldIcon} aria-hidden="true" />
                  <span>—</span>
                </span>
              )}
            </dd>
          </div>
          <DataField label="Повестка" icon={FileText} value={application.agenda ?? "—"} />
          <DataField
            label="Дата / время"
            icon={CalendarDays}
            value={application.scheduled_label ?? "—"}
          />
          <DataField
            label="Длительность"
            icon={Clock3}
            value={application.duration_minutes ? `${application.duration_minutes} мин` : "—"}
          />
          <DataField
            label="Место"
            icon={MapPin}
            value={application.invite_location ?? application.location ?? "—"}
          />
          <DataField
            label="Тип совещания"
            icon={Presentation}
            value={
              resolveMeetingTypeFromTopic(detail, resolvedTopic) ??
              application.meeting_type_label ??
              application.meeting_type ??
              "—"
            }
          />
          <DataField label="Приоритет" icon={Flag} value={application.priority ?? "—"} />
        </dl>
        {application.memo_text ? (
          <div className={styles.memoTextBlock}>
            <h4 className={styles.memoTextTitle}>Текст СЗ</h4>
            <p className={styles.memoTextBody}>{application.memo_text}</p>
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3>Чек-лист СТО</h3>
          <span
            className={`${styles.checklistSummary} ${detail.sto_ready ? styles.checklistSummaryReady : ""}`}
          >
            {stoPassedCount} из {stoChecklist.length}
            {detail.sto_ready ? " · СТО выполнен" : ""}
          </span>
        </div>
        <p className={styles.checklistIntro}>
          Обязательные условия служебной записки на совещание согласно СТО.
        </p>
        {stoChecklist.length ? (
          <ul className={styles.checkList}>
            {stoChecklist.map((item) => (
              <li
                className={`${styles.checkItem} ${styles[item.passed ? "checksuccess" : "checkerror"]}`}
                key={item.field}
              >
                {item.passed ? (
                  <CheckCircle2 size={16} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={16} aria-hidden="true" />
                )}
                <span className={styles.checkItemBody}>
                  <span>{item.label}</span>
                  {!item.passed && item.message ? (
                    <span className={styles.checkItemHint}>{item.message}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.inlineMuted}>Чек-лист СТО не загружен. Обновите карточку заявки.</p>
        )}
      </div>

      <div className={styles.section}>
        <h3>
          <History size={16} aria-hidden="true" />
          История
        </h3>
        {(detail.history ?? []).length ? (
          <ol className={styles.historyList}>
            {(detail.history ?? []).map((item, index) => (
              <li className={styles.historyItem} key={`${item.timestamp}-${index}`}>
                <span className={styles.historyTime}>
                  <Clock3 size={14} aria-hidden="true" />
                  {formatMeetingDateTime(item.timestamp)}
                </span>
                <span>{item.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.inlineMuted}>История пока пуста</p>
        )}
      </div>

      {showSeriesPlanning ? (
        <div className={styles.section}>
          <h3>Планирование серии</h3>
          <div className={styles.recommendationBox}>
            <strong>Распознана периодичность</strong>
            <p>{seriesPlanning?.recurrence_label ?? "Периодичность определена по тексту СЗ"}</p>
            {seriesPlanning?.occurrence_count ? (
              <p className={styles.inlineMuted}>
                Запланировано встреч: {seriesPlanning.occurrence_count}
              </p>
            ) : null}
            {seriesPlanning?.source_quote ? (
              <p className={styles.inlineMuted}>Фрагмент: «{seriesPlanning.source_quote}»</p>
            ) : null}
            {(seriesPlanning?.ambiguities ?? []).length ? (
              <ul className={styles.seriesAmbiguities}>
                {(seriesPlanning?.ambiguities ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {isSeriesMode ? (
              <p className={styles.seriesChoiceNote}>
                Выбрано: <strong>серия</strong> — запись создана в графике, СЗ согласована.
                Распланируйте серию в Outlook на вкладке «График совещаний».
              </p>
            ) : isSingleSeriesMode ? (
              <p className={styles.seriesChoiceNote}>
                Выбрано: <strong>единоразовое</strong> — дальше работает обычный подбор слота.
              </p>
            ) : (
              <>
                <p className={styles.inlineMuted}>
                  Уточните, как планировать совещание: серией в графике или как единоразовое.
                </p>
                <div className={styles.actionRow}>
                  {canPlanAsSeries ? (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={isRunning || isSeriesPlanningPending}
                      onClick={() => onSeriesPlanningChoice?.("series")}
                    >
                      {isTopicChecking && topicPendingAction === "series" ? (
                        <>
                          <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                          Проверяем тему…
                        </>
                      ) : isSeriesPlanningPending ? (
                        <>
                          <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                          Сохраняем серию…
                        </>
                      ) : (
                        "Запланировать серию"
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={canPlanAsSeries ? styles.secondaryButton : styles.primaryButton}
                    disabled={isRunning || isSeriesPlanningPending}
                    onClick={() => onSeriesPlanningChoice?.("single")}
                  >
                    Единоразовое
                  </button>
                </div>
              </>
            )}
            {seriesPlanningError ? (
              <p className={styles.runError} role="alert">
                {seriesPlanningError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.section}>
        <h3>Решение УД</h3>
        <div className={styles.recommendationBox}>
          <strong>Рекомендация агента</strong>
          <p>{recommendation}</p>
          {runStatus ? <p className={styles.runStatus}>Статус прогона: {runStatus}</p> : null}
          {runError ? <p className={styles.runError}>{runError}</p> : null}
        </div>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isRunning || isSeriesMode}
            onClick={onLaunchAgent}
            title={isSeriesMode ? "Для серии используйте график совещаний" : undefined}
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                {isTopicChecking && topicPendingAction === "slot"
                  ? "Проверяем тему…"
                  : "Подбираем слот…"}
              </>
            ) : (
              "Выбрать слот"
            )}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={isRunning || !canShowDecisionActions || isSeriesMode}
            onClick={onAutoApprove}
            title={
              isSeriesMode
                ? "Согласование единоразового слота недоступно — совещание запланировано серией"
                : canShowDecisionActions
                ? detail.sto_ready
                  ? undefined
                  : "Не все пункты СТО выполнены — бэкенд может отклонить согласование"
                : `СЗ уже ${visibleStatus.toLowerCase()}`
            }
          >
            {isApproving ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Согласуем…
              </>
            ) : isTopicChecking && topicPendingAction === "approve" ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Проверяем тему…
              </>
            ) : (
              "Согласовать"
            )}
          </button>
          <button
            type="button"
            className={styles.rejectButton}
            disabled={isRunning || isRejecting || !canShowDecisionActions}
            onClick={onReject}
            title={canShowDecisionActions ? undefined : `СЗ уже ${visibleStatus.toLowerCase()}`}
          >
            Отклонить
          </button>
        </div>
        {approveError ? (
          <p className={styles.runError} role="alert">
            {approveError}
          </p>
        ) : null}
        <p className={styles.footerNote}>
          Тема в 1С проверяется один раз — при согласовании, выборе слота или планировании серии.
          {resolvedTopic?.used_existing
            ? ` Используется существующая тема: ${formatResolvedMeetingTopicLabel(resolvedTopic) ?? "—"}. Совещание оформляется с тем же названием и видом совещания из 1С.`
            : formatResolvedMeetingTopicLabel(resolvedTopic)
              ? ` Выбрана тема ${formatResolvedMeetingTopicLabel(resolvedTopic)}.`
              : ""}
        </p>
      </div>
    </>
  );
}

export default function MeetingAgent() {
  return (
    <MeetingAgentErrorBoundary>
      <MeetingAgentPage />
    </MeetingAgentErrorBoundary>
  );
}