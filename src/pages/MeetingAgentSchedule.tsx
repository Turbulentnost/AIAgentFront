import { useEffect, useMemo, useState } from "react";

import {
  BarChart3,
  Archive,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  ExternalLink,
  Plus,
  Users,
  Zap
} from "lucide-react";

import LoadingPanel from "@/components/LoadingPanel";
import {
  useMeetingSchedule,
  useMeetingScheduleCancelSeries,
  useMeetingScheduleCategories,
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
  buildMeetingScheduleCategoryTiles,
  filterMeetingScheduleByCategory,
  filterMeetingScheduleByScope,
  formatMeetingScheduleParticipantsSummary,
  isMeetingScheduleArchived,
  mapMeetingScheduleItem,
  sortMeetingScheduleItems,
  type MeetingScheduleCategoryFilter,
  type MeetingScheduleScope,
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
  const [pendingCreatePayload, setPendingCreatePayload] =
    useState<MeetingScheduleSeriesSavePayload | null>(null);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [scope, setScope] = useState<MeetingScheduleScope>("active");
  const [categoryFilter, setCategoryFilter] = useState<MeetingScheduleCategoryFilter>("all");

  const categoriesQuery = useMeetingScheduleCategories(canAccessAgent);
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

  const typeCounts = scheduleQuery.data?.type_counts;
  const activeCount = useMemo(
    () => items.filter((item) => !isMeetingScheduleArchived(item)).length,
    [items]
  );
  const archiveCount = useMemo(
    () => items.filter((item) => isMeetingScheduleArchived(item)).length,
    [items]
  );
  const scopedItems = useMemo(() => filterMeetingScheduleByScope(items, scope), [items, scope]);
  const categoryTiles = useMemo(
    () => buildMeetingScheduleCategoryTiles(scopedItems, categoriesQuery.data ?? []),
    [scopedItems, categoriesQuery.data]
  );
  const visibleItems = useMemo(
    () => filterMeetingScheduleByCategory(scopedItems, categoryFilter),
    [scopedItems, categoryFilter]
  );
  const totalRecords = scope === "archive" ? archiveCount : activeCount;
  const selectedItem =
    visibleItems.find((item) => item.id === selectedId) ??
    items.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    setCategoryFilter("all");
  }, [scope]);

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId("");
      return;
    }

    if (!visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0]?.id ?? "");
    }
  }, [visibleItems, selectedId]);

  const detailQuery = useMeetingScheduleDetail(selectedId, canAccessAgent && Boolean(selectedId));
  const detailView = useMemo(
    () => (detailQuery.data ? normalizeMeetingScheduleDetail(detailQuery.data) : null),
    [detailQuery.data]
  );

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
          {scope === "archive" ? "В архиве" : "Активных серий"}: {totalRecords}
          {categoryFilter !== "all" ? ` · показано ${visibleItems.length}` : ""}
        </span>
      </header>

      <div className={styles.scheduleScopeRow} role="tablist" aria-label="Раздел графика">
        <button
          type="button"
          role="tab"
          aria-selected={scope === "active"}
          className={`${styles.scheduleScopeTile} ${
            scope === "active" ? styles.scheduleScopeTileActive : ""
          }`}
          onClick={() => setScope("active")}
        >
          <span className={styles.scheduleScopeTileIcon} aria-hidden="true">
            <CalendarClock size={18} strokeWidth={2.2} />
          </span>
          <span className={styles.scheduleScopeTileContent}>
            <strong>Активные серии</strong>
            <span>Плановые и регулярные совещания</span>
          </span>
          <span className={styles.scheduleScopeTileCount}>{activeCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "archive"}
          className={`${styles.scheduleScopeTile} ${
            scope === "archive" ? styles.scheduleScopeTileActive : ""
          }`}
          onClick={() => setScope("archive")}
        >
          <span className={styles.scheduleScopeTileIcon} aria-hidden="true">
            <Archive size={18} strokeWidth={2.2} />
          </span>
          <span className={styles.scheduleScopeTileContent}>
            <strong>Архив</strong>
            <span>Отменённые и завершённые серии</span>
          </span>
          <span className={styles.scheduleScopeTileCount}>{archiveCount}</span>
        </button>
      </div>

      {scope === "active" ? (
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
      ) : null}

      {(categoriesQuery.data?.length ?? 0) > 0 ? (
        <section className={styles.scheduleCategorySection} aria-label="Фильтр по виду совещания">
          <h3 className={styles.scheduleCategoryTitle}>Вид совещания</h3>
          <div className={styles.scheduleCategoryTiles}>
            {categoryTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className={`${styles.scheduleCategoryTile} ${
                  categoryFilter === tile.id ? styles.scheduleCategoryTileActive : ""
                } ${tile.count === 0 ? styles.scheduleCategoryTileEmpty : ""}`}
                aria-pressed={categoryFilter === tile.id}
                onClick={() => setCategoryFilter(tile.id)}
              >
                <span>{tile.label}</span>
                <span className={styles.scheduleCategoryTileCount}>{tile.count}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.schedulePanel}>
        <div className={styles.scheduleTableToolbar}>
          {scope === "active" ? (
            <button type="button" className={styles.primaryButton} onClick={handleOpenCreateDrawer}>
              <Plus size={16} aria-hidden="true" />
              Добавить
            </button>
          ) : null}
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
            <table className={`${styles.scheduleTable} ${styles.scheduleTableCompact}`}>
              <thead className={styles.scheduleTableHead}>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Руководство</th>
                  <th>Участники</th>
                  <th>Расписание</th>
                  {scope === "active" ? <th>Статус</th> : null}
                  {scope === "active" ? <th>Действия</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr>
                    <td
                      className={styles.scheduleEmptyCell}
                      colSpan={scope === "active" ? 7 : 5}
                    >
                      {scope === "archive"
                        ? "В архиве пока нет серий совещаний"
                        : categoryFilter === "all"
                          ? "Нет активных серий совещаний"
                          : "Нет серий для выбранного вида совещания"}
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((item) => {
                    const isSelected = item.id === selectedId;
                    const isArchived = isMeetingScheduleArchived(item);
                    const participantPreview = item.participant_roles.slice(0, 2).join(", ");
                    const hiddenParticipants = Math.max(
                      item.participant_roles.length - 2,
                      item.extra_participants_count ?? 0
                    );

                    return (
                      <tr
                        key={item.id}
                        className={[
                          isSelected ? styles.scheduleRowSelected : "",
                          isArchived ? styles.scheduleRowArchived : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <td className={styles.scheduleNameCell}>
                          <span className={styles.scheduleSeriesName}>{item.name}</span>
                          <span className={styles.scheduleSeriesMeta}>{item.categoryLabel}</span>
                        </td>
                        <td>
                          <span
                            className={`${styles.scheduleTypeBadge} ${styles[`scheduleTypeBadge${item.typeTone}`]}`}
                          >
                            {item.typeLabel}
                          </span>
                        </td>
                        <td className={styles.scheduleLeadershipCell}>
                          <span className={styles.scheduleLeadershipPrimary}>{item.managerLabel}</span>
                          <span className={styles.scheduleLeadershipSecondary}>
                            {item.responsibleLabel}
                          </span>
                        </td>
                        <td className={styles.scheduleParticipantsCell}>
                          <span className={styles.scheduleParticipantsSummary}>
                            {formatMeetingScheduleParticipantsSummary(item.participant_roles.length)}
                          </span>
                          {participantPreview ? (
                            <span className={styles.scheduleParticipantsPreview}>
                              {participantPreview}
                              {hiddenParticipants > 0 ? ` +${hiddenParticipants}` : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className={styles.scheduleScheduleCell}>
                          <span className={styles.scheduleSchedulePrimary}>{item.recurrenceLabel}</span>
                          <span className={styles.scheduleScheduleSecondary}>
                            {item.deadlinePrimary}
                            {item.deadlineSecondary ? ` · ${item.deadlineSecondary}` : ""}
                          </span>
                        </td>
                        {scope === "active" ? (
                          <td>
                            <span
                              className={`${styles.scheduleStatusBadge} ${styles[`scheduleStatusBadge${item.statusTone}`]}`}
                            >
                              {item.statusLabel}
                            </span>
                          </td>
                        ) : null}
                        {scope === "active" ? (
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
                                    planSeriesMutation.isPending &&
                                    planSeriesMutation.variables === item.id
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handlePlanSeries(item.id);
                                  }}
                                >
                                  {planSeriesMutation.isPending &&
                                  planSeriesMutation.variables === item.id
                                    ? "Распланируем…"
                                    : schedulePlanAction.label}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
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
