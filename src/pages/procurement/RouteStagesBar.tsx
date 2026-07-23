import { Check, GitBranch } from "lucide-react";
import type { ProcurementRouteStage } from "@/types/procurement";
import { completedStageCount } from "@/utils/procurementDashboard";
import type { ParallelBranch } from "./parallelProcurement";
import styles from "../ProcurementAgent.module.css";

type Props = {
  stages: ProcurementRouteStage[];
  selectedStageId?: string;
  onSelect?: (stageId: string) => void;
  parallelBranches?: ParallelBranch[];
  forkAfterStageId?: string;
};

export function RouteStagesBar({
  stages,
  selectedStageId,
  onSelect,
  parallelBranches = [],
  forkAfterStageId = "coverage"
}: Props) {
  const completed = completedStageCount(stages);
  const forkIndex = stages.findIndex((stage) => stage.stage_id === forkAfterStageId);
  const hasParallel = parallelBranches.length >= 2 && forkIndex >= 0;
  const before = hasParallel ? stages.slice(0, forkIndex + 1) : stages;
  const after = hasParallel ? stages.slice(forkIndex + 1) : [];

  return (
    <div className={styles.orchestratorRoute}>
      <div className={styles.routeHeader}>
        <strong>Маршрут кейса</strong>
        <span>
          {hasParallel ? (
            <>
              <GitBranch size={13} /> Параллельная работа ролевых агентов · {completed} из{" "}
              {stages.length} этапов
            </>
          ) : (
            <>
              {completed} из {stages.length} этапов завершено
            </>
          )}
        </span>
      </div>

      {hasParallel ? (
        <div className={styles.routeBranchLayout}>
          <div className={styles.routeTrack}>
            {before.map((stage, index) => (
              <StageButton
                key={stage.stage_id}
                index={index}
                onSelect={onSelect}
                selectedStageId={selectedStageId}
                stage={stage}
              />
            ))}
          </div>

          <div className={styles.routeFork}>
            <div className={styles.routeForkRail} aria-hidden="true" />
            <div className={styles.routeBranchColumn}>
              {parallelBranches.map((branch) => (
                <button
                  aria-pressed={selectedStageId === branch.id}
                  className={styles.routeBranchNode}
                  data-selected={selectedStageId === branch.id}
                  data-status={branch.status}
                  key={branch.id}
                  onClick={() => onSelect?.(branch.id)}
                  type="button"
                >
                  <div className={styles.routeDot}>
                    {branch.status === "completed" ? <Check size={14} /> : <GitBranch size={13} />}
                  </div>
                  <span>{branch.label}</span>
                  <small>{branch.summary}</small>
                </button>
              ))}
            </div>
            <div className={styles.routeMergeRail} aria-hidden="true" />
          </div>

          {after.length ? (
            <div className={styles.routeTrack}>
              {after.map((stage, index) => (
                <StageButton
                  key={stage.stage_id}
                  index={before.length + index}
                  onSelect={onSelect}
                  selectedStageId={selectedStageId}
                  stage={stage}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.routeTrack}>
          {stages.map((stage, index) => (
            <StageButton
              key={stage.stage_id}
              index={index}
              onSelect={onSelect}
              selectedStageId={selectedStageId}
              stage={stage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StageButton({
  stage,
  index,
  selectedStageId,
  onSelect
}: {
  stage: ProcurementRouteStage;
  index: number;
  selectedStageId?: string;
  onSelect?: (stageId: string) => void;
}) {
  return (
    <button
      aria-pressed={selectedStageId === stage.stage_id}
      className={styles.routeStep}
      data-selected={selectedStageId === stage.stage_id}
      data-status={stage.status}
      disabled={stage.status === "pending" || stage.status === "skipped"}
      onClick={() => onSelect?.(stage.stage_id)}
      type="button"
    >
      <div className={styles.routeDot}>
        {stage.status === "completed" ? <Check size={14} /> : index + 1}
      </div>
      <span>{stage.label}</span>
    </button>
  );
}
