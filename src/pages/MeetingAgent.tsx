import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  RefreshCw
} from "lucide-react";
import { meetingCalendarRows, meetingQueueTabs, type MeetingQueueTab } from "@/mock-data/meetingAgent";
import {
  formatMeetingIntegrationError,
  getMeetingRequestError,
  isMeetingDashboardForbidden,
  useMeetingDashboard,
  useMeetingPermissions,
  useRefreshMeetingDashboard
} from "@/hooks/useMeetingDashboard";
import {
  useCreateMeetingRun,
  useMeetingMemoDetail,
  useMeetingRunResult,
  useMeetingSlots
} from "@/hooks/useMeetingMemoDetail";
import type { MeetingDashboardItem, MeetingLoginContext, MeetingMemoDetail } from "@/types/meetings";
import {
  buildMeetingStats,
  filterMeetingItems,
  formatMeetingDate,
  formatMeetingDateTime,
  formatMeetingSlot,
  formatMeetingTime,
  getMeetingItemCode,
  getMeetingItemDate,
  getMeetingItemId,
  getMeetingItemTags,
  getMeetingItemTitle,
  getMeetingStatusLabel,
  getMemoRefKey,
  isMeetingRunActive,
  isTodayQueueItem
} from "@/utils/meetingDashboard";
import styles from "./MeetingAgent.module.css";

export default function MeetingAgent() {
  const permissionsQuery = useMeetingPermissions();
  const canAccessAgent = permissionsQuery.data?.can_access_agent ?? false;
  const dashboardQuery = useMeetingDashboard(canAccessAgent);
  const refreshDashboard = useRefreshMeetingDashboard();
  const [queueTab, setQueueTab] = useState<MeetingQueueTab>("all");
  const [selectedId, setSelectedId] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const dashboard = dashboardQuery.data;
  const queueItems = useMemo(
    () => (dashboard ? filterMeetingItems(dashboard, queueTab) : []),
    [dashboard, queueTab]
  );
  const stats = useMemo(() => (dashboard ? buildMeetingStats(dashboard) : []), [dashboard]);

  const selectedItem =
    queueItems.find((item) => getMeetingItemId(item) === selectedId) ?? queueItems[0] ?? null;
  const selectedRefKey = getMemoRefKey(selectedItem);

  const detailQuery = useMeetingMemoDetail(selectedRefKey, canAccessAgent);
  const detail = detailQuery.data;

  const slotsPayload = useMemo(() => {
    if (!selectedRefKey || !detail) return null;
    return {
      memo_ref_key: selectedRefKey,
      memo_number: detail.number,
      duration_minutes: detail.application.duration_minutes ?? 30,
      participant_fio: detail.application.participants
        .map((participant) => participant.full_name)
        .filter((name): name is string => Boolean(name))
    };
  }, [detail, selectedRefKey]);

  const slotsQuery = useMeetingSlots(slotsPayload, Boolean(detail));
  const createRun = useCreateMeetingRun();
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
  }, [selectedRefKey]);

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
          <button type="button" className={styles.retryButton} onClick={() => void handleRefreshDashboard()}>
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

  const recommendation =
    runQuery.data?.summary ||
    detail?.agent_recommendation ||
    "Запустите агента для полного анализа заявки.";

  return (
    <section className={styles.page} aria-labelledby="meeting-agent-title">
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
            {meetingQueueTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={queueTab === tab.id}
                className={`${styles.queueTab} ${queueTab === tab.id ? styles.queueTabActive : ""}`}
                onClick={() => setQueueTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {queueTab === "today" ? (
            <p className={styles.queueHint}>Служебные записки с датой документа за сегодня</p>
          ) : null}

          <div className={styles.queueList}>
            {queueItems.length ? (
              queueItems.map((item) => (
                <QueueCard
                  key={getMeetingItemId(item)}
                  item={item}
                  dashboard={dashboard}
                  queueTab={queueTab}
                  active={selectedId === getMeetingItemId(item)}
                  onSelect={() => setSelectedId(getMeetingItemId(item))}
                />
              ))
            ) : (
              <div className={styles.queueEmpty}>Заявок в этой вкладке нет</div>
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
              recommendation={recommendation}
              runStatus={runQuery.data?.status ?? createRun.data?.status}
              runError={runQuery.data?.error_message}
              isRunning={createRun.isPending || isMeetingRunActive(runQuery.data?.status)}
              onRunAgent={() => void handleRunAgent()}
            />
          ) : null}
        </section>

        <aside className={styles.contextPanel} aria-label="Контекст заявки">
          <MeetingContextPanel
            slots={slotsQuery.data ?? []}
            slotsLoading={slotsQuery.isLoading || slotsQuery.isFetching}
            slotsError={slotsQuery.isError}
            onRefreshSlots={() => slotsQuery.refetch()}
          />
        </aside>
      </div>
    </section>
  );
}

function QueueCard({
  item,
  dashboard,
  queueTab,
  active,
  onSelect
}: {
  item: MeetingDashboardItem;
  dashboard: MeetingLoginContext;
  queueTab: MeetingQueueTab;
  active: boolean;
  onSelect: () => void;
}) {
  const preferDocumentDate = isTodayQueueItem(item, dashboard, queueTab);
  const tags = getMeetingItemTags(item, { preferDocumentDate });

  return (
    <button
      type="button"
      className={`${styles.queueCard} ${active ? styles.queueCardActive : ""}`}
      onClick={onSelect}
    >
      <div className={styles.queueCardTop}>
        <strong>{getMeetingItemCode(item)}</strong>
      </div>
      <div className={styles.queueMeta}>
        <span>
          <CalendarDays size={13} aria-hidden="true" />
          {preferDocumentDate ? "Дата документа" : "Дата совещания"}:{" "}
          {item.scheduled_label || getMeetingItemDate(item, { preferDocumentDate })}
          {!preferDocumentDate && !item.scheduled_label
            ? ` · ${formatMeetingTime(item.meeting_start, item.meeting_end)}`
            : null}
        </span>
        {typeof item.participants_count === "number" ? (
          <span>Участников: {item.participants_count}</span>
        ) : null}
      </div>
      {tags.length ? (
        <div className={styles.tagRow}>
          {tags.map((tag) => (
            <span className={`${styles.tag} ${styles[`tag${tag.tone}`]}`} key={tag.label}>
              {tag.label}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function MeetingDetails({
  detail,
  recommendation,
  runStatus,
  runError,
  isRunning,
  onRunAgent
}: {
  detail: MeetingMemoDetail;
  recommendation: string;
  runStatus?: string;
  runError?: string | null;
  isRunning: boolean;
  onRunAgent: () => void;
}) {
  const application = detail.application;

  return (
    <>
      <header className={styles.detailsHead}>
        <div>
          <h2 id="meeting-details-title">
            {detail.number ? `СЗ №${detail.number}` : "Служебная записка"} · {detail.title || "Заявка на совещание"}
          </h2>
        </div>
        <span className={styles.statusBadge}>
          {getMeetingStatusLabel(detail.status, detail.status_label)}
        </span>
      </header>

      <div className={styles.section}>
        <h3>Данные заявки</h3>
        <dl className={styles.dataGrid}>
          <div><dt>Инициатор</dt><dd>{application.initiator?.full_name ?? "—"}</dd></div>
          <div><dt>Руководитель</dt><dd>{application.manager?.full_name ?? "—"}</dd></div>
          <div>
            <dt>Участники</dt>
            <dd>
              {application.participants_count}{" "}
              {application.participants.length ? (
                <span className={styles.participantList}>
                  ({application.participants.map((p) => p.full_name).filter(Boolean).join(", ")})
                </span>
              ) : null}
            </dd>
          </div>
          <div><dt>Повестка</dt><dd>{application.agenda ?? "—"}</dd></div>
          <div><dt>Дата / время</dt><dd>{application.scheduled_label ?? "—"}</dd></div>
          <div>
            <dt>Длительность</dt>
            <dd>{application.duration_minutes ? `${application.duration_minutes} мин` : "—"}</dd>
          </div>
          <div><dt>Место</dt><dd>{application.location ?? "—"}</dd></div>
          <div>
            <dt>Тип совещания</dt>
            <dd>{application.meeting_type_label ?? application.meeting_type ?? "—"}</dd>
          </div>
          <div><dt>Приоритет</dt><dd>{application.priority ?? "—"}</dd></div>
        </dl>
      </div>

      <div className={styles.section}>
        <h3>Проверки агента</h3>
        <ul className={styles.checkList}>
          {detail.validation_checks.length ? (
            detail.validation_checks.map((check) => (
              <li
                className={`${styles.checkItem} ${styles[checkToneClass(check.passed, check.severity)]}`}
                key={`${check.field}-${check.label}`}
              >
                {check.passed ? (
                  <CheckCircle2 size={16} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={16} aria-hidden="true" />
                )}
                <span>{check.label}</span>
              </li>
            ))
          ) : (
            <li className={`${styles.checkItem} ${styles.checksuccess}`}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Данные загружены из 1С ERP</span>
            </li>
          )}
        </ul>
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
          <button type="button" className={styles.primaryButton} disabled={isRunning} onClick={onRunAgent}>
            {isRunning ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Агент работает…
              </>
            ) : (
              "Запустить агента"
            )}
          </button>
          <button type="button" className={styles.secondaryButton}>Выбрать слот</button>
        </div>
        <div className={styles.tertiaryRow}>
          <button type="button" className={styles.ghostButton}>Вернуть инициатору</button>
          <button type="button" className={styles.ghostButton}>Отклонить по СТО</button>
        </div>
        <p className={styles.footerNote}>
          После подтверждения агент создаст событие в Outlook и обновит 1С ERP.
        </p>
      </div>
    </>
  );
}

function MeetingContextPanel({
  slots,
  slotsLoading,
  slotsError,
  onRefreshSlots
}: {
  slots: { start: string; end: string; confidence: number }[];
  slotsLoading: boolean;
  slotsError: boolean;
  onRefreshSlots: () => void;
}) {
  return (
    <>
      <div className={styles.section}>
        <h3>Календарная проверка</h3>
        <p className={styles.inlineMuted}>
          Превью календаря появится после подключения Outlook в ответе /detail.
        </p>
        <div className={styles.calendarHead}>
          <span>10:00</span>
          <span>10:30</span>
        </div>
        <div className={styles.calendarLegend}>
          <span><i className={styles.legendFree} /> Свободно</span>
          <span><i className={styles.legendBusy} /> Занято</span>
          <span><i className={styles.legendUnknown} /> Нет данных</span>
        </div>
        <div className={styles.calendarGrid}>
          {meetingCalendarRows.map((row) => (
            <div className={styles.calendarRow} key={row.id}>
              <span className={styles.calendarLabel}>{row.label}</span>
              <div className={styles.calendarTrack}>
                {row.segments.map((segment, index) => (
                  <span
                    className={`${styles.calendarSegment} ${styles[`segment${segment.tone}`]}`}
                    key={`${row.id}-${index}`}
                    style={{ left: `${segment.start}%`, width: `${segment.end - segment.start}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.panelHead}>
          <h3>Альтернативные слоты</h3>
          <button type="button" className={styles.refreshButton} onClick={onRefreshSlots} aria-label="Обновить слоты">
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>
        {slotsLoading ? (
          <p className={styles.inlineMuted}>Подбираем слоты…</p>
        ) : slotsError ? (
          <p className={styles.inlineMuted}>Не удалось загрузить альтернативные слоты</p>
        ) : slots.length ? (
          <div className={styles.slotRow}>
            {slots.map((slot) => (
              <button type="button" className={styles.slotButton} key={`${slot.start}-${slot.end}`}>
                {formatMeetingSlot(slot)}
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.inlineMuted}>Свободные слоты не найдены</p>
        )}
      </div>
    </>
  );
}

function checkToneClass(passed: boolean, severity: string): "checksuccess" | "checkwarning" | "checkerror" {
  if (passed) return "checksuccess";
  if (severity === "error") return "checkerror";
  return "checkwarning";
}
