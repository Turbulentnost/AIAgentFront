import type { ProcurementTimelineEntry } from "@/types/procurement";
import { formatDateTime } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  entries: ProcurementTimelineEntry[];
};

export function AgentTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return <div className={styles.emptyState}>История агентов пока пуста.</div>;
  }
  return (
    <div className={styles.timeline}>
      {entries.map((entry) => (
        <div className={styles.timelineItem} key={entry.id || `${entry.at}-${entry.title}`}>
          <div className={styles.timelineDot} data-kind={entry.kind} />
          <div className={styles.timelineBody}>
            <div className={styles.timelineTop}>
              <strong>{entry.title}</strong>
              <span>{formatDateTime(entry.at)}</span>
            </div>
            {entry.actor_label ? <div className={styles.timelineActor}>{entry.actor_label}</div> : null}
            {entry.detail ? <p>{entry.detail}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
