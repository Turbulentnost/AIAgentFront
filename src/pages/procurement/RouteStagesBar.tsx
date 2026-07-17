import type { ProcurementRouteStage } from "@/types/procurement";
import { completedStageCount } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  stages: ProcurementRouteStage[];
};

export function RouteStagesBar({ stages }: Props) {
  const completed = completedStageCount(stages);
  return (
    <div className={styles.routeCard}>
      <div className={styles.routeHeader}>
        <strong>Маршрут кейса</strong>
        <span>
          {completed} из {stages.length} этапов завершено
        </span>
      </div>
      <div className={styles.routeTrack}>
        {stages.map((stage, index) => (
          <div className={styles.routeStep} data-status={stage.status} key={stage.stage_id}>
            <div className={styles.routeDot}>{index + 1}</div>
            <span>{stage.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
