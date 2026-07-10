import { useEffect, useState } from "react";
import { pricingWorkflowSteps } from "@/mock-data/pricingAgent";
import styles from "./PricingWorkflowStepper.module.css";

export interface PricingWorkflowStepperProps {
  currentStep: number;
  /** Индекс соединителя (0 = между шагами 1 и 2), который нужно анимировать при входе на страницу. */
  animateConnectorIndex?: number | null;
}

/**
 * Горизонтальный stepper этапов маршрута с плавной анимацией закрашивания линии.
 */
export default function PricingWorkflowStepper({
  currentStep,
  animateConnectorIndex = null
}: PricingWorkflowStepperProps) {
  const [playConnectorAnimation, setPlayConnectorAnimation] = useState(false);

  useEffect(() => {
    if (animateConnectorIndex == null) return;

    const frameId = requestAnimationFrame(() => {
      setPlayConnectorAnimation(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [animateConnectorIndex]);

  return (
    <div className={styles.stepper} role="list" aria-label="Этапы маршрута">
      {pricingWorkflowSteps.map((step, index) => {
        const isActive = currentStep === step.step;
        const isDone = currentStep > step.step;
        const connectorIndex = index;
        const connectorFilled = connectorIndex < currentStep - 1;
        const shouldAnimate =
          playConnectorAnimation &&
          animateConnectorIndex === connectorIndex &&
          connectorIndex === currentStep - 2;

        return (
          <div key={step.id} className={styles.stepperSequence} role="listitem">
            <div
              className={`${styles.stepperItem} ${isActive ? styles.stepperItemActive : ""} ${isDone ? styles.stepperItemDone : ""}`}
            >
              <span className={styles.stepperCircle}>{step.step}</span>
              <span className={styles.stepperLabel}>{step.label}</span>
            </div>
            {index < pricingWorkflowSteps.length - 1 ? (
              <span
                className={`${styles.stepperConnector} ${connectorFilled && !shouldAnimate ? styles.stepperConnectorFilled : ""} ${shouldAnimate ? styles.stepperConnectorAnimating : ""}`}
                aria-hidden="true"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
