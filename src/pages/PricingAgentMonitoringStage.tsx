import { Link, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Info,
  RefreshCw,
  Shield,
  ShoppingCart,
  Sparkles,
  Target
} from "lucide-react";
import PricingWorkflowStepper from "@/components/PricingAgent/PricingWorkflowStepper";
import {
  mockPricingAgent,
  monitoringRatingLabels,
  PRICING_WORKFLOW_TOTAL_STEPS,
  type MonitoringDocumentStatus,
  type MonitoringRatingStatus,
  type MonitoringSidebarIconKey,
  type PricingMonitoringStageDetail,
  type PricingTone
} from "@/mock-data/pricingAgent";
import { PRICING_AGENT_PATH, getPricingStagePath } from "@/utils/agentLaunch";
import { getPricingStageNavigationState } from "@/utils/pricingStageNavigation";
import styles from "./PricingAgentMonitoringStage.module.css";

const sidebarIcons: Record<MonitoringSidebarIconKey, LucideIcon> = {
  target: Target,
  cart: ShoppingCart,
  progress: CheckCircle2,
  clock: Clock3,
  shield: Shield,
  risk: AlertTriangle
};

const ratingClassMap: Record<MonitoringRatingStatus, string> = {
  recommended: styles.ratingRecommended,
  expensive: styles.ratingExpensive,
  document_risk: styles.ratingDocumentRisk
};

function SidebarIcon({ icon, size = 13 }: { icon: MonitoringSidebarIconKey; size?: number }) {
  const Icon = sidebarIcons[icon];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}

export interface PricingAgentMonitoringStageProps {
  detail: PricingMonitoringStageDetail;
  animateConnectorIndex?: number | null;
}

function DocumentStatusCell({
  label,
  status
}: {
  label: string;
  status: MonitoringDocumentStatus;
}) {
  const isComplete = status === "complete";
  return (
    <span
      className={`${styles.documentCell} ${isComplete ? styles.documentComplete : styles.documentRisk}`}
    >
      {isComplete ? (
        <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <AlertTriangle size={14} strokeWidth={2.2} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

export default function PricingAgentMonitoringStage({
  detail,
  animateConnectorIndex = null
}: PricingAgentMonitoringStageProps) {
  const navigate = useNavigate();

  const handleNext = () => {
    navigate(getPricingStagePath("contract", detail.invoiceId), {
      state: getPricingStageNavigationState(detail.currentStep)
    });
  };

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
          Этап {detail.currentStep} из {PRICING_WORKFLOW_TOTAL_STEPS} — {detail.stageTitle}
        </p>
      </header>

      <PricingWorkflowStepper
        currentStep={detail.currentStep}
        animateConnectorIndex={animateConnectorIndex}
      />

      <article className={styles.contextBar}>
        <div className={styles.invoiceContext}>
          <span className={styles.invoiceIcon} aria-hidden="true">
            <FileText size={18} strokeWidth={2} />
          </span>
          <div className={styles.invoiceText}>
            <strong>
              Счет №{detail.invoiceNumber} / {detail.supplier}
            </strong>
            <span>
              Сумма: {detail.amount} • от {detail.invoiceDate}
            </span>
          </div>
        </div>

        <div className={styles.statusBlock}>
          <span className={styles.workflowBadge}>{detail.workflowStatusLabel}</span>
          <div className={styles.nextStepHint}>
            <span className={styles.nextStepLabel}>Следующий шаг</span>
            <span className={styles.nextStepValue}>{detail.nextStepLabel}</span>
          </div>
        </div>
      </article>

      <div className={styles.infoBanner} role="note">
        <Info size={16} strokeWidth={2} aria-hidden="true" />
        <p>{detail.infoMessage}</p>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} aria-labelledby="pricing-monitoring-title">
            <h2 id="pricing-monitoring-title" className={styles.panelTitle}>
              Мониторинг рынка
            </h2>

            <div className={styles.monitoringTable} role="table" aria-label="Мониторинг рынка">
              <div className={styles.monitoringHead} role="row">
                <span role="columnheader">Поставщик</span>
                <span role="columnheader">Цена</span>
                <span role="columnheader">Срок</span>
                <span role="columnheader">Условия оплаты</span>
                <span role="columnheader">Документ</span>
                <span role="columnheader">Оценка</span>
              </div>

              {detail.offers.map((offer) => (
                <div key={offer.id} className={styles.monitoringRow} role="row">
                  <span className={styles.supplierCell} role="cell">
                    <span className={styles.supplierIcon} aria-hidden="true">
                      <Building2 size={13} strokeWidth={2} />
                    </span>
                    {offer.supplier}
                  </span>
                  <span className={styles.priceCell} role="cell">
                    {offer.price}
                    {offer.priceDelta ? (
                      <span
                        className={
                          offer.priceDeltaTone === "danger"
                            ? styles.priceDeltaDanger
                            : styles.priceDeltaSuccess
                        }
                      >
                        {offer.priceDelta}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.cellMuted} role="cell">
                    {offer.term}
                  </span>
                  <span className={styles.cellMuted} role="cell">
                    {offer.paymentTerms}
                  </span>
                  <span role="cell">
                    <DocumentStatusCell label={offer.documentLabel} status={offer.documentStatus} />
                  </span>
                  <span role="cell">
                    <span className={`${styles.ratingBadge} ${ratingClassMap[offer.rating]}`}>
                      {monitoringRatingLabels[offer.rating]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="pricing-monitoring-conclusion-title">
            <div className={styles.conclusionHeader}>
              <span className={styles.conclusionIcon} aria-hidden="true">
                <Sparkles size={14} strokeWidth={2} />
              </span>
              <h2 id="pricing-monitoring-conclusion-title" className={styles.panelTitle}>
                Вывод агента
              </h2>
            </div>

            <p className={styles.conclusionSummary}>{detail.conclusionSummary}</p>

            <div className={styles.statusChipRow}>
              {detail.statusChips.map((chip) => (
                <article key={chip.id} className={styles.statusChip}>
                  <span className={styles.statusChipLabel}>
                    <span
                      className={`${styles.statusChipIcon} ${styles[`chipIcon_${chip.tone}` as `chipIcon_${PricingTone}`]}`}
                      aria-hidden="true"
                    >
                      <SidebarIcon icon={chip.icon} size={12} />
                    </span>
                    {chip.label}
                  </span>
                  <strong
                    className={`${styles.statusChipValue} ${styles[`chipValue_${chip.tone}` as `chipValue_${PricingTone}`]}`}
                  >
                    {chip.value}
                  </strong>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel} aria-labelledby="pricing-stage-progress-title">
            <h2 id="pricing-stage-progress-title" className={styles.panelTitle}>
              О ходе этапа
            </h2>
            <ul className={styles.metaList}>
              {detail.progressItems.map((item) => (
                <li key={item.id} className={styles.metaRow}>
                  <span className={styles.metaLabel}>
                    <span className={styles.metaIcon} aria-hidden="true">
                      <SidebarIcon icon={item.icon} />
                    </span>
                    {item.label}
                  </span>
                  <p className={styles.metaValue}>{item.value}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel} aria-labelledby="pricing-evaluation-title">
            <h2 id="pricing-evaluation-title" className={styles.panelTitle}>
              Критерии оценки
            </h2>
            <ul className={styles.criteriaList}>
              {detail.evaluationCriteria.map((criterion) => (
                <li key={criterion.id} className={styles.criteriaItem}>
                  <span className={styles.criteriaIcon} aria-hidden="true">
                    <SidebarIcon icon={criterion.icon} />
                  </span>
                  {criterion.label}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <footer className={styles.actionsRow}>
        <button type="button" className={styles.primaryAction} onClick={handleNext}>
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
          Сформировать файл мониторинга
        </button>
        <button type="button" className={styles.outlineAction}>
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
          Подготовить СЗ на изменение ПЦ
        </button>
        <button type="button" className={styles.outlineAction}>
          <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
          Запросить еще КП
        </button>
      </footer>
    </section>
  );
}
