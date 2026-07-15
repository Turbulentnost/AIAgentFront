import { useEffect, useMemo, useState } from "react";

import {
  BarChart3,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  GripVertical,
  Plus,
  Users,
  X,
  Zap
} from "lucide-react";

import LoadingPanel from "@/components/LoadingPanel";
import {
  useMeetingSchedule,
  useMeetingScheduleCreateSeries,
  useMeetingScheduleDetail
} from "@/hooks/useMeetingSchedule";
import { getMeetingRequestError } from "@/hooks/useMeetingDashboard";
import MeetingAgentScheduleSeriesDrawer from "@/pages/MeetingAgentScheduleSeriesDrawer";
import type { MeetingScheduleSeriesDetail, MeetingScheduleSeriesSavePayload } from "@/types/meetings";
import {
  mapMeetingScheduleItem,
  sortMeetingScheduleItems,
  type MeetingScheduleViewItem
} from "@/utils/meetingSchedule";

import styles from "./MeetingAgent.module.css";

type Props = {
  canAccessAgent: boolean;
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
  { id: "reschedule", label: "Перенести" },
  { id: "extend", label: "Продлить" }
] as const;

const schedulePlanAction = { id: "plan", label: "Распланировать" } as const;

export default function MeetingAgentSchedule({ canAccessAgent }: Props) {
  const scheduleQuery = useMeetingSchedule(canAccessAgent);
  const createSeriesMutation = useMeetingScheduleCreateSeries();
  const [selectedId, setSelectedId] = useState("");
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);

  const items = useMemo(
    () => sortMeetingScheduleItems((scheduleQuery.data?.items ?? []).map(mapMeetingScheduleItem)),
    [scheduleQuery.data?.items]
  );

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
  const typeCounts = scheduleQuery.data?.type_counts;
  const totalRecords = typeCounts?.total ?? items.length;

  function handleOpenCreateDrawer() {
    setIsCreateDrawerOpen(true);
  }

  function handleCloseCreateDrawer() {
    setIsCreateDrawerOpen(false);
  }

  function handleCreateSeries(payload: MeetingScheduleSeriesSavePayload) {
    createSeriesMutation.mutate(payload, {
      onSuccess: (created) => {
        setSelectedId(created.id);
        setIsCreateDrawerOpen(false);
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
        </div>

        <div className={styles.scheduleTableWrap}>
          <div className={styles.scheduleTableScroll}>
            <table className={styles.scheduleTable}>
              <thead className={styles.scheduleTableHead}>
                <tr>
                  <th className={styles.scheduleColDrag} aria-label="Порядок" />
                  <th>Название</th>
                  <th>Тип</th>
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
                        <button
                          type="button"
                          className={styles.scheduleNameButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(item.id);
                          }}
                        >
                          {item.name}
                        </button>
                      </td>
                      <td>
                        <span
                          className={`${styles.scheduleTypeBadge} ${styles[`scheduleTypeBadge${item.typeTone}`]}`}
                        >
                          {item.typeLabel}
                        </span>
                      </td>
                      <td>
                        <div className={styles.scheduleParticipants}>
                          {item.visibleParticipants.map((participant) => (
                            <span className={styles.scheduleParticipantPill} key={participant}>
                              {participant}
                            </span>
                          ))}
                          {item.extra_participants_count ? (
                            <span className={styles.scheduleParticipantMore}>
                              +{item.extra_participants_count}
                            </span>
                          ) : null}
                        </div>
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
                          {scheduleRowActions.map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              className={styles.scheduleActionButton}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {action.label}
                            </button>
                          ))}
                          {item.status !== "archive" ? (
                            <button
                              type="button"
                              className={`${styles.scheduleActionButton} ${styles.scheduleActionButtonPrimary}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {schedulePlanAction.label}
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
          detail={detailQuery.data}
        />
      ) : null}

      <MeetingAgentScheduleSeriesDrawer
        open={isCreateDrawerOpen}
        onClose={handleCloseCreateDrawer}
        onSave={handleCreateSeries}
        saving={createSeriesMutation.isPending}
        saveError={
          createSeriesMutation.isError ? getMeetingRequestError(createSeriesMutation.error) : null
        }
      />
    </>
  );
}

function ScheduleDetails({
  item,
  loading,
  detail
}: {
  item: MeetingScheduleViewItem;
  loading: boolean;
  detail: MeetingScheduleSeriesDetail | undefined;
}) {
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
            <span>{item.recurrenceLabel}</span>
            <span
              className={`${styles.scheduleStatusBadge} ${styles[`scheduleStatusBadge${item.statusTone}`]}`}
            >
              {item.statusLabel}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.scheduleDetailsGrid}>
        <section className={styles.scheduleDetailsColumn} aria-labelledby="schedule-history-title">
          <h4 id="schedule-history-title">История прошедших совещаний по серии</h4>
          {loading ? (
            <p className={styles.scheduleDetailsEmpty}>Загружаем историю…</p>
          ) : detail?.past_meetings.length ? (
            <ol className={styles.scheduleHistoryList}>
              {detail.past_meetings.map((meeting) => (
                <li className={styles.scheduleHistoryItem} key={meeting.id}>
                  <span className={styles.scheduleHistoryMarker} aria-hidden="true" />
                  <div className={styles.scheduleHistoryContent}>
                    <strong>
                      {meeting.date_label}, {meeting.time_label}
                    </strong>
                    {meeting.protocol_number ? (
                      <span className={styles.scheduleHistoryProtocol}>
                        Протокол {meeting.protocol_number}
                      </span>
                    ) : null}
                    <span
                      className={`${styles.scheduleHistoryOutcome} ${styles[`scheduleHistoryOutcome${meeting.outcome_tone}`]}`}
                    >
                      {meeting.outcome_label}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.scheduleDetailsEmpty}>История совещаний пока пуста</p>
          )}
        </section>

        <section className={styles.scheduleDetailsColumn} aria-labelledby="schedule-next-title">
          <h4 id="schedule-next-title">Ближайшее совещание</h4>
          {loading ? (
            <p className={styles.scheduleDetailsEmpty}>Загружаем ближайшее совещание…</p>
          ) : detail?.next_meeting ? (
            <article className={styles.scheduleNextCard}>
              <strong className={styles.scheduleNextDate}>
                {detail.next_meeting.date_label}, {detail.next_meeting.time_range_label}
              </strong>
              <span className={styles.scheduleNextFormat}>{detail.next_meeting.format_label}</span>
              <div className={styles.scheduleNextActions}>
                <button type="button" className={styles.secondaryButton}>
                  <Users size={15} aria-hidden="true" />
                  Состав участников
                </button>
                <button type="button" className={styles.secondaryButton}>
                  <CalendarClock size={15} aria-hidden="true" />
                  Перенос
                </button>
                <button type="button" className={styles.rejectButton}>
                  <X size={15} aria-hidden="true" />
                  Отмена
                </button>
              </div>
            </article>
          ) : (
            <p className={styles.scheduleDetailsEmpty}>Ближайшее совещание не запланировано</p>
          )}
        </section>
      </div>
    </section>
  );
}
