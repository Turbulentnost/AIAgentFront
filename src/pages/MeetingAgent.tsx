import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  RefreshCw
} from "lucide-react";
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
  useMeetingMemoReject,
  useMeetingRunResult
} from "@/hooks/useMeetingMemoDetail";
import MeetingAgentRegistry from "@/pages/MeetingAgentRegistry";
import MeetingAgentRejectModal from "@/pages/MeetingAgentRejectModal";
import MeetingAgentSlotPreviewModal from "@/pages/MeetingAgentSlotPreviewModal";
import type { MeetingDashboardItem, MeetingMemoDetail } from "@/types/meetings";
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
  getMemoRefKey,
  isMeetingRunActive,
  isMeetingSlotPreviewAssignable,
  normalizeOutlookMeetingUrl,
  resolveMeetingSlotPreview,
  type MeetingQueueFilter
} from "@/utils/meetingDashboard";
import styles from "./MeetingAgent.module.css";

type MeetingPageTab = "queue" | "registry";

export default function MeetingAgent() {
  const queryClient = useQueryClient();
  const permissionsQuery = useMeetingPermissions();
  const canAccessAgent = permissionsQuery.data?.can_access_agent ?? false;
  const dashboardQuery = useMeetingDashboard(canAccessAgent);
  const refreshDashboard = useRefreshMeetingDashboard();
  const [queueFilter, setQueueFilter] = useState<MeetingQueueFilter>("unapproved");
  const [selectedId, setSelectedId] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [forceMemoRefresh, setForceMemoRefresh] = useState(false);
  const [slotPreviewOpen, setSlotPreviewOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [outlookMeetingUrl, setOutlookMeetingUrl] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<MeetingPageTab>("queue");

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

  const detailQuery = useMeetingMemoDetail(selectedRefKey, canAccessAgent, forceMemoRefresh);
  const detail = detailQuery.data;

  const createRun = useCreateMeetingRun();
  const slotPreviewMutation = useMeetingAgentSlotPreview();
  const slotPreviewDetailsMutation = useMeetingAgentSlotPreviewDetails();
  const approveSlotMutation = useMeetingAgentSlotApprove();
  const approveMemoMutation = useMeetingMemoApprove();
  const rejectMemoMutation = useMeetingMemoReject();
  const runQuery = useMeetingRunResult(activeRunId);

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
  }, [selectedRefKey]);

  useEffect(() => {
    if (!detail || !selectedItem || forceMemoRefresh || detailQuery.isFetching) return;

    const participantNames = getMeetingParticipantNames(detail.application, selectedItem);
    const participantsCount = Math.max(
      detail.application.participants_count ?? 0,
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
    } catch (error) {
      setRefreshError(getMeetingRequestError(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  const isDashboardFetching = dashboardQuery.isFetching || isRefreshing;

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

  if (dashboardQuery.isLoading && !dashboard) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>Загружаем рабочую очередь…</div>
      </section>
    );
  }

  if (dashboardQuery.isError && isMeetingDashboardForbidden(dashboardQuery.error)) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>Нет доступа к данным по совещаниям.</div>
      </section>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>
          Не удалось загрузить данные по совещаниям.
          <button type="button" className={styles.retryButton} onClick={() => void dashboardQuery.refetch()}>
            Повторить
          </button>
        </div>
      </section>
    );
  }

  if (!dashboard) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>Нет данных по совещаниям.</div>
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

  async function handleLaunchAgent() {
    if (!detail?.ref_key || slotPreviewMutation.isPending) return;
    setSuccessMessage(null);
    setOutlookMeetingUrl(null);
    approveSlotMutation.reset();
    approveMemoMutation.reset();
    setSlotPreviewOpen(true);
    slotPreviewMutation.reset();
    try {
      await slotPreviewMutation.mutateAsync({
        memoRefKey: detail.ref_key,
        durationMinutes: detail.application.duration_minutes
      });
    } catch {
      // mutation error surfaced in modal
    }
  }

  function handleCloseSlotPreview() {
    if (approveSlotMutation.isPending || approveMemoMutation.isPending) return;
    setSlotPreviewOpen(false);
    slotPreviewMutation.reset();
    approveSlotMutation.reset();
    approveMemoMutation.reset();
  }

  async function handleConfirmApprove() {
    const preview = slotPreviewMutation.data;
    if (!preview || !isMeetingSlotPreviewAssignable(preview)) return;
    const slot = resolveMeetingSlotPreview(preview);
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
          subject: detail.title || detail.application.agenda || undefined,
          location:
            detail.application.invite_location ||
            detail.application.location ||
            undefined,
          attendees: preview.attendees
        }
      });
      setSlotPreviewOpen(false);
      slotPreviewMutation.reset();
      approveSlotMutation.reset();
      approveMemoMutation.reset();

      const slotMessage = result.sent
        ? `Приглашение отправлено: ${result.slot_label}${result.subject ? ` · ${result.subject}` : ""}`
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

  async function handleApproveMemo() {
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

  const slotPreviewRequestError = slotPreviewMutation.isError
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
      <MeetingAgentSlotPreviewModal
        open={slotPreviewOpen}
        loading={slotPreviewMutation.isPending}
        preview={slotPreviewMutation.data ?? null}
        requestError={slotPreviewRequestError}
        approveError={approveRequestError}
        onClose={handleCloseSlotPreview}
        onConfirmApprove={() => void handleConfirmApprove()}
        isApproving={approveSlotMutation.isPending || approveMemoMutation.isPending}
        approveWithMemo={queueFilter === "unapproved"}
        onFetchSlotDetails={async (slotStart, slotEnd) => {
          if (!detail?.ref_key) {
            throw new Error("У заявки нет ref_key для загрузки деталей слота.");
          }
          return slotPreviewDetailsMutation.mutateAsync({
            memoRefKey: detail.ref_key,
            payload: { slot_start: slotStart, slot_end: slotEnd }
          });
        }}
      />
      <MeetingAgentRejectModal
        open={rejectModalOpen}
        memoLabel={rejectMemoLabel}
        loading={rejectMemoMutation.isPending}
        error={rejectRequestError}
        onClose={handleCloseRejectModal}
        onConfirm={(payload) => void handleConfirmReject(payload)}
      />
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

      {dashboard.error ? (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{formatMeetingIntegrationError(dashboard.error)}</span>
        </div>
      ) : null}

      <div className={styles.pageTabs} role="tablist" aria-label="Разделы агента совещаний">
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
          aria-selected={pageTab === "registry"}
          className={`${styles.pageTab} ${pageTab === "registry" ? styles.pageTabActive : ""}`}
          onClick={() => setPageTab("registry")}
        >
          Реестр совещаний
        </button>
      </div>

      {pageTab === "registry" ? (
        <MeetingAgentRegistry canAccessAgent={canAccessAgent} />
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
                slotPreviewMutation.isPending ||
                rejectMemoMutation.isPending ||
                approveMemoMutation.isPending
              }
              isRejecting={rejectMemoMutation.isPending}
              isApproving={approveMemoMutation.isPending}
              approveError={approveMemoError}
              onLaunchAgent={() => void handleLaunchAgent()}
              onAutoApprove={() => void handleApproveMemo()}
              onReject={() => handleOpenRejectModal()}
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
        <span className={`${styles.queueCardStatus} ${styles[`queueCardStatus${statusTone}`]}`}>
          {statusLabel}
        </span>
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
  onLaunchAgent,
  onAutoApprove,
  onReject
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
  onLaunchAgent: () => void;
  onAutoApprove?: () => void;
  onReject?: () => void;
}) {
  const application = detail.application;
  const participantNames = getMeetingParticipantNames(application, queueItem);
  const stoChecklist = detail.sto_checklist ?? [];
  const stoPassedCount = countPassedStoChecklist(detail);
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
          <div><dt>Инициатор</dt><dd>{application.initiator?.full_name ?? "—"}</dd></div>
          <div><dt>Руководитель</dt><dd>{application.manager?.full_name ?? "—"}</dd></div>
          <div className={styles.participantsField}>
            <dt>Участники</dt>
            <dd className={styles.participantNames}>
              {participantNames.length ? participantNames.join(", ") : "—"}
            </dd>
          </div>
          <div><dt>Повестка</dt><dd>{application.agenda ?? "—"}</dd></div>
          <div><dt>Дата / время</dt><dd>{application.scheduled_label ?? "—"}</dd></div>
          <div>
            <dt>Длительность</dt>
            <dd>{application.duration_minutes ? `${application.duration_minutes} мин` : "—"}</dd>
          </div>
          <div>
            <dt>Место</dt>
            <dd>{application.invite_location ?? application.location ?? "—"}</dd>
          </div>
          <div>
            <dt>Тип совещания</dt>
            <dd>{application.meeting_type_label ?? application.meeting_type ?? "—"}</dd>
          </div>
          <div><dt>Приоритет</dt><dd>{application.priority ?? "—"}</dd></div>
        </dl>
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
        {detail.sto_issues?.length ? (
          <ul className={styles.stoIssuesList} aria-label="Невыполненные пункты СТО">
            {detail.sto_issues.map((issue) => (
              <li className={styles.stoIssueItem} key={issue.field}>
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.section}>
        <h3>
          <History size={16} aria-hidden="true" />
          История
        </h3>
        {detail.history.length ? (
          <ol className={styles.historyList}>
            {detail.history.map((item, index) => (
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

      <div className={styles.section}>
        <h3>Решение УД</h3>
        <div className={styles.recommendationBox}>
          <strong>Рекомендация агента</strong>
          <p>{recommendation}</p>
          {runStatus ? <p className={styles.runStatus}>Статус прогона: {runStatus}</p> : null}
          {runError ? <p className={styles.runError}>{runError}</p> : null}
        </div>
        <div className={styles.actionRow}>
          <button type="button" className={styles.primaryButton} disabled={isRunning} onClick={onLaunchAgent}>
            {isRunning ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Подбираем слот…
              </>
            ) : (
              "Выбрать слот"
            )}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={isRunning || !canShowDecisionActions}
            onClick={onAutoApprove}
            title={
              canShowDecisionActions
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
          После подтверждения агент создаст событие в Outlook и обновит 1С ERP.
        </p>
      </div>
    </>
  );
}