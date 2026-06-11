import styles from "@/pages/KnowledgeBaseCreate.module.css";
import { useSidebarStepAnimation } from "@/hooks/useSidebarStepAnimation";

export type SidebarStepDefinition = {
  label: string;
  hint: string;
};

type AnimatedSidebarStepsProps = {
  steps: readonly SidebarStepDefinition[];
  activeIndex: number;
};

function getConnectorState(
  connectorIndex: number,
  doneConnectors: Set<number>,
  activeConnector: number | null,
  connectorPhase: ReturnType<typeof useSidebarStepAnimation>["connectorPhase"]
) {
  if (activeConnector === connectorIndex && connectorPhase === "retract") return "retract" as const;
  if (doneConnectors.has(connectorIndex)) return "done" as const;
  if (activeConnector === connectorIndex && connectorPhase) return connectorPhase;
  return "pending" as const;
}

function getStepCircleClass({
  isDone,
  isVisualActive,
  isBouncing,
  isPopping,
  isLeavingHidden
}: {
  isDone: boolean;
  isVisualActive: boolean;
  isBouncing: boolean;
  isPopping: boolean;
  isLeavingHidden: boolean;
}) {
  if (isPopping) return styles.stepCirclePop;
  if (isLeavingHidden) return styles.stepCircleHidden;
  if (isBouncing) return styles.stepCircleBounce;
  if (isVisualActive) return styles.stepCircleActive;
  if (isDone) return styles.stepCircleDone;
  return "";
}

export default function AnimatedSidebarSteps({ steps, activeIndex }: AnimatedSidebarStepsProps) {
  const {
    visualActiveIndex,
    doneConnectors,
    connectorPhase,
    activeConnector,
    bouncingStep,
    poppingStep,
    leavingStep
  } = useSidebarStepAnimation(activeIndex);

  return (
    <div className={styles.stepsList} role="list">
      {steps.map((step, index) => {
        const isLeaving = index === leavingStep;
        const isPopping = index === poppingStep;
        const isLeavingHidden = isLeaving && !isPopping;
        const isDone = index < visualActiveIndex && !isLeaving;
        const isVisualActive = index === visualActiveIndex && !isLeaving;
        const isBouncing = index === bouncingStep;
        const connectorState =
          index < steps.length - 1
            ? getConnectorState(index, doneConnectors, activeConnector, connectorPhase)
            : null;

        const stepCircleClass = getStepCircleClass({
          isDone,
          isVisualActive,
          isBouncing,
          isPopping,
          isLeavingHidden
        });

        return (
          <div
            key={step.label}
            role="listitem"
            aria-current={isVisualActive ? "step" : undefined}
            className={[
              styles.stepItem,
              isDone ? styles.stepItemDone : "",
              isVisualActive ? styles.stepItemActive : "",
              !isDone && !isVisualActive && !isLeaving ? styles.stepItemPending : "",
              isLeaving ? styles.stepItemLeaving : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={[styles.stepCircle, stepCircleClass].filter(Boolean).join(" ")}>
              <span className={styles.stepCircleInner}>{index + 1}</span>
              {isPopping ? <span className={styles.stepCirclePopRing} aria-hidden="true" /> : null}
            </span>
            <span className={styles.stepCopy}>
              <strong className={styles.stepItemTitle}>{step.label}</strong>
              <small className={styles.stepHint}>{step.hint}</small>
            </span>

            {connectorState ? (
              <div
                className={[
                  styles.stepConnector,
                  connectorState === "done" ? styles.stepConnectorDone : "",
                  connectorState !== "pending" && connectorState !== "done" ? styles.stepConnectorAnimating : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-phase={connectorState === "pending" || connectorState === "done" ? undefined : connectorState}
                aria-hidden="true"
              >
                <span className={styles.stepConnectorPending} />
                <span className={styles.stepConnectorDashGrow} />
                <span className={styles.stepConnectorSolid} />
                <span className={styles.stepConnectorEnergy} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
