import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Calendar,
  FileText,
  Hourglass,
  RefreshCw,
  Shield,
  Upload,
  User,
  Users
} from "lucide-react";
import PricingStagePageFrame from "@/components/PricingAgent/PricingStagePageFrame";
import type { PricingSettlementStageDetail, PricingTone } from "@/mock-data/pricingAgent";
import { getPricingStagePath } from "@/utils/agentLaunch";
import { getPricingStageNavigationState } from "@/utils/pricingStageNavigation";
import shared from "./pricingStageShared.module.css";
import styles from "./PricingAgentSettlementStage.module.css";

export interface PricingAgentSettlementStageProps {
  detail: PricingSettlementStageDetail;
  animateConnectorIndex?: number | null;
}

const kpiIcons = {
  approval: Users,
  approver: User,
  date: Calendar,
  risk: AlertTriangle
};

const kpiToneClass: Record<PricingTone, string> = {
  blue: styles.kpiBlue,
  green: styles.kpiGreen,
  violet: styles.kpiViolet,
  amber: styles.kpiAmber,
  mint: styles.kpiMint
};

export default function PricingAgentSettlementStage({
  detail,
  animateConnectorIndex = null
}: PricingAgentSettlementStageProps) {
  const navigate = useNavigate();

  const handleNext = () => {
    navigate(getPricingStagePath("completed", detail.invoiceId), {
      state: getPricingStageNavigationState(detail.currentStep)
    });
  };

  return (
    <PricingStagePageFrame
      currentStep={detail.currentStep}
      stageTitle={detail.stageTitle}
      animateConnectorIndex={animateConnectorIndex}
    >
      <div className={styles.progressHeader}>
        <span className={shared.stageBadge}>Этап {detail.currentStep} из 8</span>
        <div className={styles.progressTrack} aria-label={`${detail.progressPercent}% выполнено`}>
          <span className={styles.progressFill} style={{ width: `${detail.progressPercent}%` }} />
        </div>
        <span className={styles.progressLabel}>{detail.progressPercent}% выполнено</span>
      </div>

      <div className={styles.kpiRow}>
        {detail.kpis.map((kpi) => {
          const Icon = kpiIcons[kpi.id as keyof typeof kpiIcons] ?? FileText;
          return (
            <article key={kpi.id} className={`${styles.kpiCard} ${kpiToneClass[kpi.tone]}`}>
              <span className={styles.kpiIcon} aria-hidden="true">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <strong className={styles.kpiValue}>{kpi.value}</strong>
              <span className={styles.kpiSub}>{kpi.sublabel}</span>
            </article>
          );
        })}
      </div>

      <div className={shared.contentGrid}>
        <section className={`${shared.panel} ${styles.timelinePanel}`} aria-labelledby="approval-timeline-title">
          <h2 id="approval-timeline-title" className={shared.panelTitle}>
            Ход согласования
          </h2>
          <ol className={styles.timeline}>
            {detail.timeline.map((item) => (
              <li
                key={item.id}
                className={`${styles.timelineItem} ${styles[`timeline_${item.status}`]}`}
              >
                <span className={styles.timelineDot} aria-hidden="true">
                  {item.status === "current" ? (
                    <Hourglass size={12} strokeWidth={2.2} />
                  ) : (
                    <FileText size={12} strokeWidth={2.2} />
                  )}
                </span>
                <div className={styles.timelineBody}>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <div className={styles.timelineMeta}>
                    <time>{item.timestamp}</time>
                    <span>{item.user}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className={styles.sideStack}>
          <section className={`${shared.panel} ${styles.impactPanel}`}>
            <h2 className={shared.panelTitle}>Влияние задержки</h2>
            <div className={styles.impactBox}>
              <AlertTriangle size={16} strokeWidth={2.2} aria-hidden="true" />
              <p>{detail.delayImpact}</p>
            </div>
          </section>

          <section className={`${shared.panel} ${styles.actionsPanel}`}>
            <h2 className={shared.panelTitle}>Доступные действия</h2>
            <div className={styles.sideActions}>
              <button type="button" className={shared.primaryAction} onClick={handleNext}>
                <Bell size={14} strokeWidth={2} aria-hidden="true" />
                Напомнить согласующему
              </button>
              <button type="button" className={shared.outlineAction}>
                <Upload size={14} strokeWidth={2} aria-hidden="true" />
                Эскалировать
              </button>
              <button type="button" className={shared.outlineAction}>
                <Shield size={14} strokeWidth={2} aria-hidden="true" />
                Передать агенту рисков
              </button>
            </div>
          </section>
        </div>
      </div>

      <p className={styles.updateNote}>
        <RefreshCw size={12} strokeWidth={2} aria-hidden="true" />
        Данные обновляются автоматически. Последнее обновление: {detail.lastUpdated}
      </p>
    </PricingStagePageFrame>
  );
}
