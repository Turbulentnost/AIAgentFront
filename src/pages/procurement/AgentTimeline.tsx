import type { ProcurementTimelineEntry } from "@/types/procurement";
import { formatDateTime } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  entries: ProcurementTimelineEntry[];
};

const EVENT_TITLES: Record<string, string> = {
  engineer_purchase_confirmed: "Закупка подтверждена инженером",
  engineer_handoff_to_chief_dispatcher: "Кейс передан главному диспетчеру",
  engineer_critical_acknowledged: "Критическая проблема принята в работу"
};

export function AgentTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return <div className={styles.emptyState}>История агентов пока пуста.</div>;
  }
  return (
    <div className={`${styles.timeline} ${styles.timelineScroll}`}>
      {entries.map((entry) => (
        <div className={styles.timelineItem} key={entry.id || `${entry.at}-${entry.title}`}>
          <div className={styles.timelineDot} data-kind={entry.kind} />
          <div className={styles.timelineBody}>
            <div className={styles.timelineTop}>
              <strong>{EVENT_TITLES[entry.title] || entry.title}</strong>
              <span>{formatDateTime(entry.at)}</span>
            </div>
            {entry.actor_label ? <div className={styles.timelineActor}>{entry.actor_label}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
