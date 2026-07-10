import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import PricingWorkflowStepper from "@/components/PricingAgent/PricingWorkflowStepper";
import { mockPricingAgent, PRICING_WORKFLOW_TOTAL_STEPS } from "@/mock-data/pricingAgent";
import { PRICING_AGENT_PATH } from "@/utils/agentLaunch";
import styles from "./PricingStagePageFrame.module.css";

export interface PricingStagePageFrameProps {
  currentStep: number;
  stageTitle: string;
  animateConnectorIndex?: number | null;
  children: ReactNode;
}

export default function PricingStagePageFrame({
  currentStep,
  stageTitle,
  animateConnectorIndex = null,
  children
}: PricingStagePageFrameProps) {
  return (
    <section className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Навигация">
        <Link to="/agents">Агенты</Link>
        <ChevronRight size={12} strokeWidth={2.2} aria-hidden="true" />
        <Link to={PRICING_AGENT_PATH}>{mockPricingAgent.name}</Link>
        <ChevronRight size={12} strokeWidth={2.2} aria-hidden="true" />
        <span aria-current="page">Этапы</span>
      </nav>

      <header className={styles.pageHeader}>
        <h1>{mockPricingAgent.name}</h1>
        <p>
          Этап {currentStep} из {PRICING_WORKFLOW_TOTAL_STEPS} — {stageTitle}
        </p>
      </header>

      <PricingWorkflowStepper
        currentStep={currentStep}
        animateConnectorIndex={animateConnectorIndex}
      />

      {children}
    </section>
  );
}
