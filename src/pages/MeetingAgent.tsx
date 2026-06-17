import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Users
} from "lucide-react";
import {
  meetingAlternativeSlots,
  meetingCalendarRows,
  meetingHistory,
  meetingQueueItems,
  meetingQueueTabs,
  meetingRequestDetails,
  meetingStats,
  type MeetingQueueTab
} from "@/mock-data/meetingAgent";
import styles from "./MeetingAgent.module.css";

export default function MeetingAgent() {
  const [queueTab, setQueueTab] = useState<MeetingQueueTab>("all");
  const [selectedId, setSelectedId] = useState(meetingQueueItems[0]?.id ?? "");

  const selectedItem = meetingQueueItems.find((item) => item.id === selectedId) ?? meetingQueueItems[0];
  const details =
    selectedItem?.id === meetingRequestDetails.id ? meetingRequestDetails : meetingRequestDetails;

  return (
    <section className={styles.page} aria-labelledby="meeting-agent-title">
      <div className={styles.statsRow} aria-label="Сводка по заявкам">
        {meetingStats.map((stat) => (
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

          <div className={styles.queueList}>
            {meetingQueueItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.queueCard} ${selectedId === item.id ? styles.queueCardActive : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className={styles.queueCardTop}>
                  <strong>{item.code}</strong>
                  <span>{item.title}</span>
                </div>
                <div className={styles.queueMeta}>
                  <span>
                    <CalendarDays size={13} aria-hidden="true" />
                    {item.date} · {item.time}
                  </span>
                  <span>
                    <Users size={13} aria-hidden="true" />
                    {item.participants}
                  </span>
                </div>
                <div className={styles.tagRow}>
                  {item.tags.map((tag) => (
                    <span className={`${styles.tag} ${styles[`tag${tag.tone}`]}`} key={tag.label}>
                      {tag.label}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <button type="button" className={styles.queueMore}>
            Показать ещё заявки (23)
          </button>
        </aside>

        <section className={styles.detailsPanel} aria-labelledby="meeting-details-title">
          <header className={styles.detailsHead}>
            <div>
              <h2 id="meeting-details-title">
                {details.code} · {details.title}
              </h2>
            </div>
            <span className={styles.statusBadge}>{details.statusLabel}</span>
          </header>

          <div className={styles.section}>
            <h3>Данные заявки</h3>
            <dl className={styles.dataGrid}>
              <div><dt>Инициатор</dt><dd>{details.initiator}</dd></div>
              <div><dt>Руководитель</dt><dd>{details.manager}</dd></div>
              <div>
                <dt>Участники</dt>
                <dd>
                  {details.participants}{" "}
                  <button type="button" className={styles.linkButton}>список</button>
                </dd>
              </div>
              <div><dt>Повестка</dt><dd>{details.agenda}</dd></div>
              <div><dt>Дата / время</dt><dd>{details.date} · {details.time}</dd></div>
              <div><dt>Длительность</dt><dd>{details.duration}</dd></div>
              <div><dt>Место</dt><dd>{details.location}</dd></div>
              <div>
                <dt>Приоритет</dt>
                <dd>
                  <span className={`${styles.priorityBadge} ${styles.priorityHigh}`}>{details.priority}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.section}>
            <h3>Проверки агента</h3>
            <ul className={styles.checkList}>
              {details.checks.map((check) => (
                <li className={`${styles.checkItem} ${styles[`check${check.tone}`]}`} key={check.id}>
                  {check.tone === "success" ? (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={16} aria-hidden="true" />
                  )}
                  <span>{check.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.section}>
            <h3>Решение УД</h3>
            <div className={styles.recommendationBox}>
              <strong>Рекомендация агента</strong>
              <p>{details.recommendation}</p>
            </div>
            <div className={styles.actionRow}>
              <button type="button" className={styles.primaryButton}>Подтвердить</button>
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
        </section>

        <aside className={styles.contextPanel} aria-label="Контекст заявки">
          <div className={styles.section}>
            <h3>Календарная проверка</h3>
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
                    {row.id === "petrov" && (
                      <span className={styles.calendarSelection} aria-hidden="true" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h3>Альтернативные слоты</h3>
            <div className={styles.slotRow}>
              {meetingAlternativeSlots.map((slot) => (
                <button type="button" className={styles.slotButton} key={slot}>
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h3>
              <History size={16} aria-hidden="true" />
              История
            </h3>
            <ol className={styles.historyList}>
              {meetingHistory.map((item) => (
                <li className={styles.historyItem} key={item.id}>
                  <span className={styles.historyTime}>
                    <Clock3 size={14} aria-hidden="true" />
                    {item.time}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </section>
  );
}
