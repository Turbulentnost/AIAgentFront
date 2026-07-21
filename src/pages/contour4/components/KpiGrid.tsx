import type { Contour4Kpi } from "@/types/contour4";
import styles from "../Contour4Workspace.module.css";
import {
  formatKpiValue,
  kpiStatus,
  progressPct,
  statusLabel
} from "../kpiUtils";
import {
  kpiProgressClassMap,
  kpiStatusClassMap,
  statusClass
} from "../lib/statusClass";

export default function KpiGrid({ kpis }: { kpis: Contour4Kpi[] }) {
  const statusMap = kpiStatusClassMap(styles);
  const progressMap = kpiProgressClassMap(styles);

  return (
    <>
      <h2 className={styles.sectionTitle}>Показатели эффективности (KPI)</h2>
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => {
          const st = kpiStatus(kpi);
          const pct = progressPct(kpi);
          const blocking = kpi.blocking && st !== "ok";
          return (
            <article
              key={kpi.id}
              className={blocking ? styles.kpiCardBlocking : styles.kpiCard}
            >
              <div className={styles.kpiCardTop}>
                <span className={styles.kpiId}>{kpi.id}</span>
                {blocking ? (
                  <span className={styles.badgeBlocking}>БЛОКИРУЮЩИЙ</span>
                ) : null}
              </div>
              <div className={styles.kpiName}>{kpi.name}</div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{formatKpiValue(kpi)}</span>
                <span className={styles.kpiTarget}>цель {kpi.target}</span>
              </div>
              <div className={styles.progress}>
                <i
                  className={statusClass({ ...progressMap, default: styles.progressBelow }, st)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div
                className={statusClass(
                  { ...statusMap, default: styles.kpiStatusBelow },
                  st
                )}
              >
                <span className={styles.dot} />
                {statusLabel(st)}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
