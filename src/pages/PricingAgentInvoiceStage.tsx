import { Link, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Hash,
  Link2,
  Package
} from "lucide-react";
import {
  mockPricingAgent,
  PRICING_WORKFLOW_TOTAL_STEPS,
  pricingRiskLabels,
  type PricingCheckIconKey,
  type PricingCheckStatus,
  type PricingInvoiceStageDetail
} from "@/mock-data/pricingAgent";
import PricingWorkflowStepper from "@/components/PricingAgent/PricingWorkflowStepper";
import { getPricingStagePath, PRICING_AGENT_PATH } from "@/utils/agentLaunch";
import styles from "./PricingAgentInvoiceStage.module.css";

const checkIcons: Record<PricingCheckIconKey, LucideIcon> = {
  supplier: Building2,
  nomenclature: Package,
  quantity: Hash,
  price: CircleDollarSign,
  delivery: Calendar,
  "payment-terms": CreditCard,
  requisites: FileText,
  "order-link": Link2
};

const checkStatusLabels: Record<PricingCheckStatus, string> = {
  match: "Соответствует",
  review: "Требует проверки"
};

function CheckIcon({ icon, size = 14 }: { icon: PricingCheckIconKey; size?: number }) {
  const Icon = checkIcons[icon];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}

export interface PricingAgentInvoiceStageProps {
  detail: PricingInvoiceStageDetail;
  animateConnectorIndex?: number | null;
}

export default function PricingAgentInvoiceStage({
  detail,
  animateConnectorIndex = null
}: PricingAgentInvoiceStageProps) {
  const navigate = useNavigate();

  const handleGoToProjectPrice = () => {
    navigate(getPricingStagePath("project_price", detail.invoiceId), {
      state: { animateConnectorIndex: detail.currentStep - 1 }
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

      <article className={styles.summaryCard}>
        <div className={styles.summaryLead}>
          <span className={styles.summaryIcon} aria-hidden="true">
            <FileText size={24} strokeWidth={2} />
          </span>
          <div className={styles.summaryTitleBlock}>
            <h2>
              Счет №{detail.invoiceNumber} от {detail.invoiceDate}
            </h2>
            <div className={styles.summarySupplier}>
              <span className={styles.summaryFactLabel}>Поставщик</span>
              <strong>{detail.supplier}</strong>
            </div>
          </div>
        </div>

        <span className={styles.summaryDivider} aria-hidden="true" />

        <div className={styles.summaryFact}>
          <span className={styles.summaryFactLabel}>Сумма</span>
          <strong className={styles.summaryAmount}>{detail.amount}</strong>
        </div>

        <span className={styles.summaryDivider} aria-hidden="true" />

        <div className={styles.summaryFact}>
          <span className={styles.summaryFactLabel}>Основание</span>
          <strong>{detail.basis}</strong>
        </div>

        <span className={styles.summaryDivider} aria-hidden="true" />

        <div className={styles.summaryStatusBlock}>
          <span className={styles.summaryFactLabel}>Статус</span>
          <span className={styles.summaryStatus}>{detail.stageStatusLabel}</span>
        </div>
      </article>

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} aria-labelledby="pricing-stage-result-title">
            <div className={styles.resultBanner}>
              <span className={styles.resultIcon} aria-hidden="true">
                <AlertTriangle size={18} strokeWidth={2} />
              </span>
              <div className={styles.resultBody}>
                <h2 id="pricing-stage-result-title">Итог этапа</h2>
                <p>{detail.stageResult}</p>
              </div>
              <span className={`${styles.riskBadge} ${styles[`risk_${detail.riskLevel}`]}`}>
                <span className={styles.riskDot} aria-hidden="true" />
                {pricingRiskLabels[detail.riskLevel]}
              </span>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="pricing-checks-title">
            <h2 id="pricing-checks-title" className={styles.panelTitle}>
              Проверки счета
            </h2>
            <div className={styles.checksTable} role="table" aria-label="Проверки счета">
              <div className={styles.checksHead} role="row">
                <span role="columnheader">Проверка</span>
                <span role="columnheader">Результат</span>
              </div>
              {detail.checks.map((check) => (
                <div key={check.id} className={styles.checksRow} role="row">
                  <span className={styles.checksLabel} role="cell">
                    <span className={styles.checksLabelIcon} aria-hidden="true">
                      <CheckIcon icon={check.icon} />
                    </span>
                    {check.label}
                  </span>
                  <span
                    className={`${styles.checksResult} ${check.status === "match" ? styles.checksResultMatch : styles.checksResultReview}`}
                    role="cell"
                  >
                    {check.status === "match" ? (
                      <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                    ) : (
                      <AlertTriangle size={14} strokeWidth={2.2} aria-hidden="true" />
                    )}
                    {checkStatusLabels[check.status]}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel} aria-labelledby="pricing-meta-title">
            <h2 id="pricing-meta-title" className={styles.panelTitle}>
              Основные данные
            </h2>
            <ul className={styles.metaList}>
              {detail.meta.map((item) => (
                <li key={item.id} className={styles.metaRow}>
                  <span className={styles.metaLabel}>
                    <span className={styles.metaIcon} aria-hidden="true">
                      <CheckIcon icon={item.icon} />
                    </span>
                    {item.label}
                  </span>
                  {item.badge === "verified" ? (
                    <span className={styles.verifiedBadge}>{item.value}</span>
                  ) : (
                    <strong className={styles.metaValue}>{item.value}</strong>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <footer className={styles.actionsRow}>
        <button type="button" className={styles.primaryAction} onClick={handleGoToProjectPrice}>
          Перейти к проектной цене
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" className={styles.secondaryAction}>
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
          Запросить исправленный счет
        </button>
        <button type="button" className={styles.secondaryAction}>
          <Clock3 size={14} strokeWidth={2} aria-hidden="true" />
          Журнал проверки
        </button>
      </footer>
    </section>
  );
}
