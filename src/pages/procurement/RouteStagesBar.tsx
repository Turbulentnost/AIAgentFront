import { useMemo } from "react";
import { Check, GitBranch } from "lucide-react";
import type { ProcurementRouteStage } from "@/types/procurement";
import type { ParallelBranch } from "./parallelProcurement";
import styles from "../ProcurementAgent.module.css";

type Props = {
  stages: ProcurementRouteStage[];
  selectedStageId?: string;
  onSelect?: (stageId: string) => void;
  parallelBranches?: ParallelBranch[];
  /** Single next stage after fork point when there is no parallel work. */
  continuation?: ParallelBranch | null;
  forkAfterStageId?: string;
};

type GraphNode = {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "blocked" | "skipped";
  column: number;
  lane: number;
  kind: "stage" | "branch";
  summary?: string;
};

const COL_W = 168;
const LANE_H = 72;
const PAD_X = 36;
const PAD_Y = 28;
const NODE_R = 13;

function reachedStages(stages: ProcurementRouteStage[]): ProcurementRouteStage[] {
  // Будущие этапы (pending) не показываем — они появляются по ходу работы агентов.
  return stages.filter(
    (stage) => stage.status === "completed" || stage.status === "running"
  );
}

function trunkToFork(
  stages: ProcurementRouteStage[],
  forkAfterStageId: string
): ProcurementRouteStage[] {
  const forkIndex = stages.findIndex((stage) => stage.stage_id === forkAfterStageId);
  if (forkIndex < 0) return reachedStages(stages);
  return stages.slice(0, forkIndex + 1).map((stage) => ({
    ...stage,
    status:
      stage.status === "pending" || stage.status === "skipped"
        ? ("completed" as const)
        : stage.status
  }));
}

function buildGraph(
  stages: ProcurementRouteStage[],
  parallelBranches: ParallelBranch[],
  forkAfterStageId: string,
  continuation?: ParallelBranch | null
): { nodes: GraphNode[]; laneCount: number } {
  const hasParallel = parallelBranches.length >= 2;
  const forkIndex = stages.findIndex((stage) => stage.stage_id === forkAfterStageId);

  if (hasParallel && forkIndex >= 0) {
    // Параллель: ствол до точки ветвления, дальше N веток (picker / PM / ОТК).
    const trunk = trunkToFork(stages, forkAfterStageId);
    const branchCount = parallelBranches.length;
    const midLane = Math.floor((branchCount - 1) / 2);
    const nodes: GraphNode[] = trunk.map((stage, column) => ({
      id: stage.stage_id,
      label: stage.label,
      status: stage.status,
      column,
      lane: midLane,
      kind: "stage",
      summary: stage.summary || undefined
    }));
    const branchColumn = trunk.length;
    parallelBranches.forEach((branch, index) => {
      nodes.push({
        id: branch.id,
        label: branch.label,
        status: branch.status,
        column: branchColumn,
        lane: index,
        kind: "branch",
        summary: branch.summary
      });
    });
    return { nodes, laneCount: Math.max(branchCount, 1) };
  }

  if (continuation && forkIndex >= 0) {
    // Полное покрытие: комплектовщик закрыт, линейно следующий этап — менеджер по закупкам.
    const trunk = trunkToFork(stages, forkAfterStageId);
    const nodes: GraphNode[] = trunk.map((stage, column) => ({
      id: stage.stage_id,
      label: stage.label,
      status: stage.status,
      column,
      lane: 0,
      kind: "stage",
      summary: stage.summary || undefined
    }));
    nodes.push({
      id: continuation.id,
      label: continuation.label,
      status: continuation.status,
      column: trunk.length,
      lane: 0,
      kind: "branch",
      summary: continuation.summary
    });
    return { nodes, laneCount: 1 };
  }

  const reached = reachedStages(stages);
  return {
    laneCount: 1,
    nodes: reached.map((stage, column) => ({
      id: stage.stage_id,
      label: stage.label,
      status: stage.status,
      column,
      lane: 0,
      kind: "stage" as const,
      summary: stage.summary || undefined
    }))
  };
}

function nodeCenter(node: GraphNode, laneCount: number) {
  const laneOffset = laneCount === 1 ? 0 : node.lane;
  return {
    x: PAD_X + node.column * COL_W,
    y: PAD_Y + laneOffset * LANE_H
  };
}

export function RouteStagesBar({
  stages,
  selectedStageId,
  onSelect,
  parallelBranches = [],
  continuation = null,
  forkAfterStageId = "coverage"
}: Props) {
  const { nodes, laneCount } = useMemo(
    () => buildGraph(stages, parallelBranches, forkAfterStageId, continuation),
    [continuation, forkAfterStageId, parallelBranches, stages]
  );

  const maxColumn = nodes.reduce((max, node) => Math.max(max, node.column), 0);
  const width = Math.max(PAD_X * 2 + maxColumn * COL_W + 160, 320);
  const hasParallel = laneCount > 1;
  const height = PAD_Y * 2 + Math.max(laneCount - 1, 0) * LANE_H + (hasParallel ? 64 : 40);
  const forkNode = nodes.find(
    (node) => node.kind === "stage" && node.id === forkAfterStageId
  );
  const branchNodes = nodes.filter((node) => node.kind === "branch");
  const trunkNodes = nodes
    .filter((node) => node.kind === "stage" || (!hasParallel && node.kind === "branch"))
    .sort((left, right) => left.column - right.column);

  return (
    <div className={styles.orchestratorRoute}>
      <div className={styles.routeHeader}>
        <strong>Маршрут кейса</strong>
        <span>
          {hasParallel ? (
            <>
              <GitBranch size={13} /> Параллельная работа ролевых агентов
            </>
          ) : continuation ? (
            <>
              <GitBranch size={13} /> Следующий этап: {continuation.label}
            </>
          ) : (
            <>
              {nodes.length
                ? `${nodes.filter((node) => node.status === "completed").length} из ${nodes.length} достигнутых этапов`
                : "Этапы появятся по мере работы агентов"}
            </>
          )}
        </span>
      </div>

      <div className={styles.routeGitScroll}>
        <div className={styles.routeGitCanvas} style={{ width, height }}>
          <svg
            aria-hidden="true"
            className={styles.routeGitSvg}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
          >
            {trunkNodes.slice(0, -1).map((node, index) => {
              const from = nodeCenter(node, laneCount);
              const to = nodeCenter(trunkNodes[index + 1], laneCount);
              return (
                <line
                  className={styles.routeGitEdge}
                  key={`trunk-${node.id}-${trunkNodes[index + 1].id}`}
                  x1={from.x}
                  x2={to.x}
                  y1={from.y}
                  y2={to.y}
                />
              );
            })}
            {hasParallel && forkNode
              ? branchNodes.map((branch) => {
                  const from = nodeCenter(forkNode, laneCount);
                  const to = nodeCenter(branch, laneCount);
                  const midX = from.x + (to.x - from.x) * 0.55;
                  return (
                    <path
                      className={`${styles.routeGitEdge} ${styles.routeGitEdgeBranch}`}
                      d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
                      fill="none"
                      key={`branch-edge-${branch.id}`}
                    />
                  );
                })
              : null}
          </svg>

          {nodes.map((node) => {
            const { x, y } = nodeCenter(node, laneCount);
            const selected = selectedStageId === node.id;
            return (
              <button
                aria-pressed={selected}
                className={styles.routeGitNode}
                data-kind={node.kind}
                data-selected={selected}
                data-status={node.status}
                key={node.id}
                onClick={() => onSelect?.(node.id)}
                style={{ left: x, top: y, width: COL_W - 24 }}
                type="button"
              >
                <span className={styles.routeGitDot} style={{ width: NODE_R * 2, height: NODE_R * 2 }}>
                  {node.status === "completed" ? (
                    <Check size={12} />
                  ) : node.kind === "branch" ? (
                    <GitBranch size={12} />
                  ) : (
                    node.column + 1
                  )}
                </span>
                <span className={styles.routeGitLabel}>{node.label}</span>
                {node.kind === "branch" && node.summary ? (
                  <small className={styles.routeGitSummary}>{node.summary}</small>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
