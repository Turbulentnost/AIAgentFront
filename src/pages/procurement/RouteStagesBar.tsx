import { Check } from "lucide-react";
import type { ProcurementRouteStage } from "@/types/procurement";
import { completedStageCount } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  stages: ProcurementRouteStage[];
  selectedStageId?: string;
  onSelect?: (stageId: string) => void;
};

export function RouteStagesBar({ stages, selectedStageId, onSelect }: Props) {
  const completed = completedStageCount(stages);
  return (
    <div className={styles.orchestratorRoute}>
      <div className={styles.routeHeader}>
        <strong>Маршрут кейса</strong>
        <span>
          {completed} из {stages.length} этапов завершено
        </span>
      </div>
      <div className={styles.routeTrack}>
        {stages.map((stage, index) => (
          <button
            aria-pressed={selectedStageId === stage.stage_id}
            className={styles.routeStep}
            data-selected={selectedStageId === stage.stage_id}
            data-status={stage.status}
            disabled={stage.status === "pending" || stage.status === "skipped"}
            key={stage.stage_id}
            onClick={() => onSelect?.(stage.stage_id)}
            type="button"
          >
            <div className={styles.routeDot}>
              {stage.status === "completed" ? <Check size={14} /> : index + 1}
            </div>
            <span>{stage.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
