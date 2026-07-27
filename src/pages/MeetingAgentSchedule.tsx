import { useEffect, useMemo, useState } from "react";

import {
  BarChart3,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  ExternalLink,
  GripVertical,
  Plus,
  Users,
  Zap
} from "lucide-react";

import LoadingPanel from "@/components/LoadingPanel";
import {
  useMeetingSchedule,
  useMeetingScheduleCancelSeries,
  useMeetingScheduleCreateSeries,
  useMeetingSchedulePlanSeries,
  useMeetingScheduleDetail,
  useMeetingScheduleSeriesForEdit,
  useMeetingScheduleUpdateSeries
} from "@/hooks/useMeetingSchedule";
import { getMeetingRequestError } from "@/hooks/useMeetingDashboard";
import MeetingAgentScheduleCancelModal from "@/pages/MeetingAgentScheduleCancelModal";
import MeetingAgentScheduleSeriesDrawer from "@/pages/MeetingAgentScheduleSeriesDrawer";
import MeetingAgentScheduleSeriesEditDrawer from "@/pages/MeetingAgentScheduleSeriesEditDrawer";
import MeetingAgentTopicModal from "@/pages/MeetingAgentTopicModal";
import type {
  MeetingScheduleSeriesDetailView,
  MeetingScheduleSeriesSavePayload,
  MeetingTopicResolveRead,
  ScheduledMeetingAppliedChanges,
  ScheduledMeetingRead
} from "@/types/meetings";
import {
  applyResolvedTopicToSchedulePayload,
  scheduleTopicSnapshotFromPayload
} from "@/utils/meetingTopic";
import {
  mapMeetingScheduleItem,
  sortMeetingScheduleItems,
  type MeetingScheduleViewItem
} from "@/utils/meetingSchedule";
import { canPlanMeetingScheduleSeries, canCancelMeetingScheduleSeries, canEditMeetingScheduleSeries, normalizeMeetingScheduleDetail } from "@/utils/meetingScheduleApi";

import styles from "./MeetingAgent.module.css";

type Props = {
  canAccessAgent: boolean;
  initialSelectedId?: string | null;
};

const statCards = [
  { id: "total", key: "total" as const, label: "Всего", icon: Calendar },
  { id: "planned", key: "planned" as const, label: "Плановые", icon: CalendarCheck2 },
  { id: "report", key: "report" as const, label: "Отчётные", icon: BarChart3 },
  { id: "selector", key: "selector" as const, label: "Селекторы", icon: Users },
  { id: "unplanned", key: "unplanned" as const, label: "Внеплановые", icon: Zap }
];

const scheduleRowActions = [
  { id: "edit", label: "Изменить" },
  { id: "cancel", label: "Отменить" }
] as const;

const schedulePlanAction = { id: "plan", label: "Распланировать" } as const;

export default function MeetingAgentSchedule({
  canAccessAgent,
  initialSelectedId = null
}: Props) {
  const scheduleQuery = useMeetingSchedule(canAccessAgent);
  const createSeriesMutation = useMeetingScheduleCreateSeries();
  const planSeriesMutation = useMeetingSchedulePlanSeries();
  const cancelSeriesMutation = useMeetingScheduleCancelSeries();
  const updateSeriesMutation = useMeetingScheduleUpdateSeries();
  const [selectedId, setSelectedId] = useState("");
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [editSeriesId, setEditSeriesId] = useState<string | null>(null);
  const [cancelSeriesTarget, setCancelSeriesTarget] = useState<MeetingScheduleViewItem | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(null);
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState<string | null>(null);
  const [expandedParticipantRowIds, setExpandedParticipantRowIds] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingCreatePayload, setPendingCreatePayload] =
    useState<MeetingScheduleSeriesSavePayload | null>(null);
  const [topicModalOpen, setTopicModalOpen] = useState(false);

  const editSeriesQuery = useMeetingScheduleSeriesForEdit(
    editSeriesId,
    canAccessAgent && Boolean(editSeriesId)
  );

  const items = useMemo(
    () => sortMeetingScheduleItems((scheduleQuery.data?.items ?? []).map(mapMeetingScheduleItem)),
    [scheduleQuery.data?.items]
  );

  useEffect(() => {
    if (!initialSelectedId) return;
    setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  useEffect(() => {
    if (!items.length) {
      setSelectedId("");
      return;
    }

    if (!items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id ?? "");
    }
  }, [items, selectedId]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const detailQuery = useMeetingScheduleDetail(selectedId, canAccessAgent && Boolean(selectedId));
  const detailView = useMemo(
    () => (detailQuery.data ? normalizeMeetingScheduleDetail(detailQuery.data) : null),
    [detailQuery.data]
  );
  const typeCounts = scheduleQuery.data?.type_counts;
  const totalRecords = typeCounts?.total ?? items.length;

  function handleToggleParticipantsRow(rowId: string) {
    setExpandedParticipantRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function handleOpenCreateDrawer() {
    setIsCreateDrawerOpen(true);
  }

  function handleCloseCreateDrawer() {
    setIsCreateDrawerOpen(false);
  }

  function handleOpenEditDrawer(meetingId: string) {
    setEditSuccessMessage(null);
    setEditSeriesId(meetingId);
  }

  function handleCloseEditDrawer() {
    setEditSeriesId(null);
  }

  function handleUpdateSeries(input: {
    meetingId: string;
    original: ScheduledMeetingRead;
    payload: MeetingScheduleSeriesSavePayload;
  }) {
    updateSeriesMutation.mutate(input, {
      onSuccess: (result) => {
        setSelectedId(result.series.id);
        setEditSuccessMessage(
          buildEditSuccessMessage(result.applied_changes.changes, result.applied_changes)
        );
        setEditSeriesId(null);
      }
    });
  }

  function handleCreateSeries(payload: MeetingScheduleSeriesSavePayload) {
    setPendingCreatePayload(payload);
    setTopicModalOpen(true);
  }

  function handleCloseTopicModal() {
    if (createSeriesMutation.isPending) return;
    setTopicModalOpen(false);
    setPendingCreatePayload(null);
  }

  function handleTopicResolved(resolvedTopic: MeetingTopicResolveRead) {
    if (!pendingCreatePayload) return;
    const finalPayload = applyResolvedTopicToSchedulePayload(pendingCreatePayload, resolvedTopic);
    setTopicModalOpen(false);
    setPendingCreatePayload(null);
    createSeriesMutation.mutate(finalPayload, {
      onSuccess: (created) => {
        setSelectedId(created.id);
        setIsCreateDrawerOpen(false);
      }
    });
  }

  function handleOpenCancelModal(item: MeetingScheduleViewItem) {
    setCancelSuccessMessage(null);
    setCancelSeriesTarget(item);
  }

  function handleCloseCancelModal() {
    if (cancelSeriesMutation.isPending) return;
    setCancelSeriesTarget(null);
    cancelSeriesMutation.reset();
  }

  function handleConfirmCancelSeries(message: string) {
    if (!cancelSeriesTarget) return;
    cancelSeriesMutation.mutate(
      { meetingId: cancelSeriesTarget.id, message },
      {
        onSuccess: (result) => {
          setCancelSeriesTarget(null);
          const warnings = [result.outlook_warning, result.registry_warning].filter(Boolean);
          setCancelSuccessMessage(
            warnings.length
              ? `Серия «${result.series.title}» отменена. ${warnings.join(" ")}`
              : `Серия «${result.series.title}» отменена и перенесена в архив`
          );
        }
      }
    );
  }

  function handlePlanSeries(meetingId: string) {
    setPlanError(null);
    planSeriesMutation.mutate(meetingId, {
      onSuccess: () => {
        setPlanError(null);
      },
      onError: (error) => {
        setPlanError(getMeetingRequestError(error));
      }
    });
  }

  if (scheduleQuery.isLoading && !scheduleQuery.data) {
    return <LoadingPanel title="Загружаем график совещаний…" />;
  }

  if (scheduleQuery.isError) {
    return (
      <div className={styles.scheduleErrorPanel}>
        <p>{getMeetingRequestError(scheduleQuery.error)}</p>
      </div>
    );
  }

  return (
    <>
      <header className={styles.scheduleHeader}>
        <div>
          <h2 className={styles.scheduleTitle}>График совещаний</h2>
          <p className={styles.scheduleSubtitle}>
            Плановые и регулярные серии совещаний на год вперед
          </p>
        </div>
        <span className={styles.scheduleTotalCount}>
          Всего записей: {totalRecords}
        </span>
      </header>

      <div className={styles.scheduleStatsRow} aria-label="Сводка по типам серий">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className={styles.scheduleStatCard} key={card.id}>
              <span className={styles.scheduleStatIcon} aria-hidden="true">
                <Icon size={16} strokeWidth={2.2} />
              </span>
              <div className={styles.scheduleStatContent}>
                <strong>{typeCounts?.[card.key] ?? 0}</strong>
                <span>{card.label}</span>
              </div>
            </article>
          );
        })}
      </div>

      <section className={styles.schedulePanel}>
        <div className={styles.scheduleTableToolbar}>
          <button type="button" className={styles.primaryButton} onClick={handleOpenCreateDrawer}>
            <Plus size={16} aria-hidden="true" />
            Добавить
          </button>
          {planError ? <p className={styles.scheduleToolbarError}>{planError}</p> : null}
          {editSuccessMessage ? (
            <p className={styles.scheduleToolbarSuccess}>{editSuccessMessage}</p>
          ) : null}
          {cancelSuccessMessage ? (
            <p className={styles.scheduleToolbarSuccess}>{cancelSuccessMessage}</p>
          ) : null}
        </div>

        <div className={styles.scheduleTableWrap}>
          <div className={styles.scheduleTableScroll}>
            <table className={styles.scheduleTable}>
              <thead className={styles.scheduleTableHead}>
                <tr>
                  <th className={styles.scheduleColDrag} aria-label="Порядок" />
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Вид</th>
                  <th>Руководитель</th>
                  <th>Ответственный</th>
                  <th>Участники</th>
                  <th>Периодичность</th>
                  <th>Срок</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? styles.scheduleRowSelected : ""}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td className={styles.scheduleColDrag}>
                        <button
                          type="button"
                          className={styles.scheduleDragHandle}
                          aria-label={`Изменить порядок: ${item.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <GripVertical size={16} aria-hidden="true" />
                        </button>
                      </td>
                      <td>
                        <span className={styles.scheduleSeriesName}>{item.name}</span>
                      </td>
                      <td>
                        <span
                          className={`${styles.scheduleTypeBadge} ${styles[`scheduleTypeBadge${item.typeTone}`]}`}
                        >
                          {item.typeLabel}
                        </span>
                      </td>
                      <td>{item.categoryLabel}</td>
                      <td>{item.managerLabel}</td>
                      <td>{item.responsibleLabel}</td>
                      <td>
                        {(() => {
                          const isExpanded = expandedParticipantRowIds.has(item.id);
                          const hasHiddenParticipants = item.extra_participants_count > 0;
                          const participantsToShow = isExpanded
                            ? item.participant_roles
                            : item.visibleParticipants;

                          return (
                            <div
                              className={`${styles.scheduleParticipants} ${
                                isExpanded ? styles.scheduleParticipantsExpanded : ""
                              }`}
                            >
                              {participantsToShow.map((participant) => (
                                <span className={styles.scheduleParticipantPill} key={participant}>
                                  {participant}
                                </span>
                              ))}
                              {hasHiddenParticipants ? (
                                <button
                                  type="button"
                                  className={styles.scheduleParticipantMore}
                                  aria-expanded={isExpanded}
                                  aria-label={
                                    isExpanded
                                      ? "Свернуть список участников"
                                      : `Показать всех участников (${item.participant_roles.length})`
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleToggleParticipantsRow(item.id);
                                  }}
                                >
                                  {isExpanded
                                    ? "Свернуть"
                                    : `+${item.extra_participants_count}`}
                                </button>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className={styles.scheduleFrequencyCell}>{item.recurrenceLabel}</td>
                      <td className={styles.scheduleDeadlineCell}>
                        <span className={styles.scheduleDeadlinePrimary}>{item.deadlinePrimary}</span>
                        {item.deadlineSecondary ? (
                          <span className={styles.scheduleDeadlineSecondary}>
                            {item.deadlineSecondary}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={`${styles.scheduleStatusBadge} ${styles[`scheduleStatusBadge${item.statusTone}`]}`}
                        >
                          {item.statusLabel}
                        </span>
                      </td>
                      <td>
                        <div className={styles.scheduleActions}>
                          {scheduleRowActions
                            .filter((action) => {
                              if (action.id === "cancel") {
                                return canCancelMeetingScheduleSeries(item);
                              }
                              if (action.id === "edit") {
                                return canEditMeetingScheduleSeries(item);
                              }
                              return true;
                            })
                            .map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              className={`${styles.scheduleActionButton} ${
                                action.id === "cancel" ? styles.scheduleActionButtonDanger : ""
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (action.id === "edit") {
                                  handleOpenEditDrawer(item.id);
                                }
                                if (action.id === "cancel") {
                                  handleOpenCancelModal(item);
                                }
                              }}
                              disabled={
                                action.id === "cancel" &&
                                cancelSeriesMutation.isPending &&
                                cancelSeriesTarget?.id === item.id
                              }
                            >
                              {action.id === "cancel" &&
                              cancelSeriesMutation.isPending &&
                              cancelSeriesTarget?.id === item.id
                                ? "Отменяем…"
                                : action.label}
                            </button>
                          ))}
                          {canPlanMeetingScheduleSeries(item) ? (
                            <button
                              type="button"
                              className={`${styles.scheduleActionButton} ${styles.scheduleActionButtonPrimary}`}
                              disabled={
                                planSeriesMutation.isPending && planSeriesMutation.variables === item.id
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePlanSeries(item.id);
                              }}
                            >
                              {planSeriesMutation.isPending && planSeriesMutation.variables === item.id
                                ? "Распланируем…"
                                : schedulePlanAction.label}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedItem ? (
        <ScheduleDetails
          item={selectedItem}
          loading={detailQuery.isLoading}
          error={detailQuery.isError ? getMeetingRequestError(detailQuery.error) : null}
          detail={detailView}
          onCancelSeries={
            canCancelMeetingScheduleSeries(selectedItem)
              ? () => handleOpenCancelModal(selectedItem)
              : undefined
          }
          cancelPending={
            cancelSeriesMutation.isPending && cancelSeriesTarget?.id === selectedItem.id
          }
        />
      ) : null}

      <MeetingAgentScheduleCancelModal
        open={Boolean(cancelSeriesTarget)}
        seriesLabel={cancelSeriesTarget?.name ?? "Серия совещаний"}
        loading={cancelSeriesMutation.isPending}
        error={
          cancelSeriesMutation.isError ? getMeetingRequestError(cancelSeriesMutation.error) : null
        }
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancelSeries}
      />
      <MeetingAgentScheduleSeriesDrawer
        open={isCreateDrawerOpen}
        onClose={handleCloseCreateDrawer}
        onSave={handleCreateSeries}
        saving={createSeriesMutation.isPending}
        saveError={
          createSeriesMutation.isError ? getMeetingRequestError(createSeriesMutation.error) : null
        }
      />
      {pendingCreatePayload ? (
        <MeetingAgentTopicModal
          mode="schedule"
          open={topicModalOpen}
          schedule={scheduleTopicSnapshotFromPayload(pendingCreatePayload)}
          onClose={handleCloseTopicModal}
          onResolved={handleTopicResolved}
        />
      ) : null}
      <MeetingAgentScheduleSeriesEditDrawer
        open={Boolean(editSeriesId)}
        meetingId={editSeriesId}
        series={editSeriesQuery.data}
        loadingSeries={editSeriesQuery.isLoading && !editSeriesQuery.data}
        seriesError={
          editSeriesQuery.isError ? getMeetingRequestError(editSeriesQuery.error) : null
        }
        onClose={handleCloseEditDrawer}
        onSave={handleUpdateSeries}
        saving={updateSeriesMutation.isPending}
        saveError={
          updateSeriesMutation.isError ? getMeetingRequestError(updateSeriesMutation.error) : null
        }
      />
    </>
  );
}

function buildEditSuccessMessage(changes: string[], applied: ScheduledMeetingAppliedChanges): string {
  const labels: Record<string, string> = {
    series_end_date: "срок серии",
    recurrence: "периодичность",
    comment: "комментарий",
    participants: "участники"
  };
  if (!changes.length) return "Изменений не было";
  const readable = changes.map((change) => labels[change] ?? change);
  const parts = [`Серия обновлена: ${readable.join(", ")}`];
  if (applied.participants_added.length) {
    parts.push(`добавлены: ${applied.participants_added.join(", ")}`);
  }
  if (applied.participants_removed.length) {
    parts.push(`удалены: ${applied.participants_removed.join(", ")}`);
  }
  return parts.join(" — ");
}

function ScheduleDetails({
  item,
  loading,
  error,
  detail,
  onCancelSeries,
  cancelPending = false
}: {
  item: MeetingScheduleViewItem;
  loading: boolean;
  error: string | null;
  detail: MeetingScheduleSeriesDetailView | null;
  onCancelSeries?: () => void;
  cancelPending?: boolean;
}) {
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const next = detail?.nextOccurrence ?? null;
  const nextOutlookUrl = next?.outlookMeetingUrl ?? detail?.outlookMeetingUrl ?? null;
  const allParticipants =
    detail?.participants.length ? detail.participants : item.participant_roles;

  return (
    <section className={styles.scheduleDetailsPanel} aria-labelledby="schedule-details-title">
      <header className={styles.scheduleDetailsHead}>
        <div>
          <h3 id="schedule-details-title">{item.name}</h3>
          <div className={styles.scheduleDetailsMeta}>
            <span
              className={`${styles.scheduleTypeBadge} ${styles[`scheduleTypeBadge${item.typeTone}`]}`}
            >
              {item.typeLabel}
            </span>
            <span>{detail?.recurrenceLabel ?? item.recurrenceLabel}</span>
            <span
              className={`${styles.scheduleStatusBadge} ${styles[`scheduleStatusBadge${item.statusTone}`]}`}
            >
              {item.statusLabel}
            </span>
            {detail?.usesRuleFallback ? (
              <span className={styles.scheduleDetailsFallbackBadge}>Расчёт по правилу</span>
            ) : null}
          </div>
        </div>
      </header>

      {allParticipants.length ? (
        <div className={styles.scheduleDetailsParticipants} id="schedule-series-participants">
          <div className={styles.scheduleDetailsParticipantsHead}>
            <h4>Участники серии</h4>
            {allParticipants.length > 2 ? (
              <button
                type="button"
                className={styles.scheduleParticipantMore}
                aria-expanded={showAllParticipants}
                onClick={() => setShowAllParticipants((current) => !current)}
              >
                {showAllParticipants
                  ? "Свернуть"
                  : `Показать всех (${allParticipants.length})`}
              </button>
            ) : null}
          </div>
          <div
            className={`${styles.scheduleParticipants} ${
              showAllParticipants ? styles.scheduleParticipantsExpanded : ""
            }`}
          >
            {(showAllParticipants ? allParticipants : allParticipants.slice(0, 2)).map(
              (participant) => (
                <span className={styles.scheduleParticipantPill} key={participant}>
                  {participant}
                </span>
              )
            )}
            {!showAllParticipants && allParticipants.length > 2 ? (
              <span className={styles.scheduleParticipantMoreMuted}>
                +{allParticipants.length - 2}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.scheduleDetailsError}>{error}</p> : null}

      <div className={styles.scheduleDetailsGrid}>
        <section className={styles.scheduleDetailsColumn} aria-labelledby="schedule-history-title">
          <h4 id="schedule-history-title">История прошедших совещаний по серии</h4>
          {loading ? (
            <p className={styles.scheduleDetailsEmpty}>Загружаем историю…</p>
          ) : detail?.pastOccurrences.length ? (
            <ol className={styles.schedulePastList}>
              {detail.pastOccurrences.map((occurrence) => (
                <li className={styles.schedulePastItem} key={occurrence.occurrenceKey}>
                  <div className={styles.schedulePastDateBadge} aria-hidden="true">
                    <strong>{occurrence.calendarDayLabel}</strong>
                    <span>{occurrence.calendarMonthLabel}</span>
                  </div>
                  <div className={styles.schedulePastContent}>
                    <strong>{occurrence.listDateLabel}</strong>
                    <span>{occurrence.timeRangeLabel}</span>
                    <span className={styles.schedulePastSubject}>{occurrence.subject}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.scheduleDetailsEmpty}>История совещаний пока пуста</p>
          )}
        </section>

        <section className={styles.scheduleDetailsColumn} aria-labelledby="schedule-next-title">
          <h4 id="schedule-next-title">
            Предстоящие встречи серии
            {detail?.occurrenceCount ? ` (${detail.occurrenceCount})` : ""}
          </h4>
          {loading ? (
            <p className={styles.scheduleDetailsEmpty}>Загружаем встречи серии…</p>
          ) : detail?.upcomingOccurrences.length ? (
            <ol className={styles.schedulePastList}>
              {detail.upcomingOccurrences.map((occurrence) => (
                <li className={styles.schedulePastItem} key={occurrence.occurrenceKey}>
                  <div className={styles.schedulePastDateBadge} aria-hidden="true">
                    <strong>{occurrence.calendarDayLabel}</strong>
                    <span>{occurrence.calendarMonthLabel}</span>
                  </div>
                  <div className={styles.schedulePastContent}>
                    <strong>{occurrence.listDateLabel}</strong>
                    <span>{occurrence.timeRangeLabel}</span>
                    <span className={styles.schedulePastSubject}>{occurrence.subject}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : next ? (
            <article className={styles.scheduleNextHero}>
              <div className={styles.scheduleNextHeroDateBadge} aria-hidden="true">
                <strong>{next.calendarDayLabel}</strong>
                <span>{next.calendarMonthLabel}</span>
              </div>
              <div className={styles.scheduleNextHeroBody}>
                <strong className={styles.scheduleNextHeroTitle}>
                  {next.subject || detail?.seriesTitle || item.name}
                </strong>
                <p className={styles.scheduleNextHeroDate}>{next.dateLabel}</p>
                <p className={styles.scheduleNextHeroTime}>{next.timeRangeLabel}</p>

                {allParticipants.length ? (
                  <div className={styles.scheduleNextParticipants}>
                    {allParticipants.map((participant) => (
                      <span className={styles.scheduleParticipantPill} key={participant}>
                        {participant}
                      </span>
                    ))}
                  </div>
                ) : null}

                {nextOutlookUrl ? (
                  <a
                    className={styles.scheduleNextOutlookLink}
                    href={nextOutlookUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    Открыть в Outlook
                  </a>
                ) : null}

                <div className={styles.scheduleNextActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setShowAllParticipants(true);
                      document
                        .getElementById("schedule-series-participants")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                  >
                    <Users size={15} aria-hidden="true" />
                    Состав участников
                  </button>
                  <button type="button" className={styles.secondaryButton}>
                    <CalendarClock size={15} aria-hidden="true" />
                    Перенос
                  </button>
                  {onCancelSeries ? (
                    <button
                      type="button"
                      className={styles.rejectButton}
                      disabled={cancelPending}
                      onClick={onCancelSeries}
                    >
                      {cancelPending ? "Отменяем…" : "Отмена"}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ) : (
            <p className={styles.scheduleDetailsEmpty}>Предстоящие встречи не запланированы</p>
          )}
        </section>
      </div>

      {detail?.comment ? (
        <footer className={styles.scheduleDetailsComment}>
          <span className={styles.scheduleDetailsCommentLabel}>Комментарий</span>
          <p>{detail.comment}</p>
        </footer>
      ) : null}
    </section>
  );
}
