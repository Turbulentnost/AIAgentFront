import { Link, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Cable,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  FileText,
  Gauge,
  Info,
  LayoutGrid,
  LineChart,
  Percent,
  Plug,
  Search,
  Sparkles,
  Wrench
} from "lucide-react";
import PricingWorkflowStepper from "@/components/PricingAgent/PricingWorkflowStepper";
import {
  mockPricingAgent,
  PRICING_WORKFLOW_TOTAL_STEPS,
  pricingComparisonStatusLabels,
  type PricingIconKey,
  type PricingProjectPriceStageDetail,
  type PricingTone
} from "@/mock-data/pricingAgent";
import { PRICING_AGENT_PATH, getPricingStagePath } from "@/utils/agentLaunch";
import styles from "./PricingAgentProjectPriceStage.module.css";

const pricingIcons: Record<PricingIconKey, LucideIcon> = {
  invoice: FileText,
  grid: LayoutGrid,
  chart: LineChart,
  percent: Percent,
  user: CircleDollarSign,
  wallet: CircleDollarSign,
  file: FileText,
  trend: LineChart,
  "payment-request": FileText,
  overdue: AlertTriangle,
  "invoice-stage": FileText,
  "project-price": CircleDollarSign,
  monitoring: Search,
  contract: FileText,
  "payment-app": FileText,
  payment: CircleDollarSign,
  settlement: CircleDollarSign
};

const rowIcons: LucideIcon[] = [Cpu, Gauge, Cable, Box, Plug, Wrench];

function PricingIcon({
  icon,
  size = 16,
  strokeWidth = 2
}: {
  icon: PricingIconKey;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = pricingIcons[icon];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export interface PricingAgentProjectPriceStageProps {
  detail: PricingProjectPriceStageDetail;
  animateConnectorIndex?: number | null;
}

export default function PricingAgentProjectPriceStage({
  detail,
  animateConnectorIndex = null
}: PricingAgentProjectPriceStageProps) {
  const navigate = useNavigate();

  const handleStartMonitoring = () => {
    navigate(getPricingStagePath("monitoring", detail.invoiceId), {
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

        <div className={styles.alertBlock}>
          <div className={styles.alertMessage}>
            <span className={styles.alertIcon} aria-hidden="true">
              <AlertTriangle size={14} strokeWidth={2.2} />
            </span>
            <p className={styles.alertText}>{detail.alertMessage}</p>
          </div>
          <span className={styles.alertBadge}>{detail.alertBadge}</span>
        </div>
      </article>

      <div className={styles.kpiRow}>
        {detail.kpis.map((kpi) => (
          <article key={kpi.id} className={styles.kpiCard}>
            <span className={`${styles.kpiIcon} ${styles[`tone_${kpi.tone}`]}`} aria-hidden="true">
              <PricingIcon icon={kpi.icon} size={18} />
            </span>
            <div className={styles.kpiBody}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <strong className={`${styles.kpiValue} ${styles[`value_${kpi.tone}` as `value_${PricingTone}`]}`}>
                {kpi.value}
              </strong>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.contentGrid}>
        <section className={styles.panel} aria-labelledby="pricing-comparison-title">
          <h2 id="pricing-comparison-title" className={styles.panelTitle}>
            Сравнение с проектной ценой
          </h2>

          <div className={styles.comparisonTable} role="table" aria-label="Сравнение с проектной ценой">
            <div className={styles.comparisonHead} role="row">
              <span role="columnheader">Номенклатура</span>
              <span role="columnheader">Кол-во</span>
              <span role="columnheader">Цена в счете</span>
              <span role="columnheader">Проектная цена</span>
              <span role="columnheader">Отклонение</span>
              <span role="columnheader">Статус</span>
            </div>

            {detail.comparisonRows.map((row, index) => {
              const RowIcon = rowIcons[index % rowIcons.length];
              return (
                <div key={row.id} className={styles.comparisonRow} role="row">
                  <span className={styles.nomenclatureCell} role="cell">
                    <span className={styles.nomenclatureIcon} aria-hidden="true">
                      <RowIcon size={13} strokeWidth={2} />
                    </span>
                    {row.name}
                  </span>
                  <span className={styles.cellMuted} role="cell">
                    {row.quantity}
                  </span>
                  <span className={styles.cellStrong} role="cell">
                    {row.invoicePrice}
                  </span>
                  <span className={styles.cellStrong} role="cell">
                    {row.projectPrice}
                  </span>
                  <span
                    className={row.deviationTone === "warning" ? styles.deviationWarning : styles.deviationSuccess}
                    role="cell"
                  >
                    {row.deviation}
                  </span>
                  <span role="cell">
                    <span
                      className={`${styles.statusBadge} ${row.status === "above" ? styles.statusAbove : styles.statusAcceptable}`}
                    >
                      {pricingComparisonStatusLabels[row.status]}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <button type="button" className={styles.showAllLink}>
            Показать все {detail.comparisonTotal} позиций
            <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </section>

        <aside className={styles.panel} aria-labelledby="pricing-conclusion-title">
          <div className={styles.conclusionHeader}>
            <span className={styles.conclusionIcon} aria-hidden="true">
              <Sparkles size={14} strokeWidth={2} />
            </span>
            <h2 id="pricing-conclusion-title" className={styles.panelTitle}>
              Вывод агента
            </h2>
          </div>

          <p className={styles.conclusionSummary}>{detail.conclusionSummary}</p>

          <ul className={styles.conclusionActions}>
            {detail.conclusionActions.map((action) => (
              <li key={action.id} className={styles.conclusionAction}>
                <span className={styles.conclusionActionIcon} aria-hidden="true">
                  <PricingIcon icon={action.icon} size={13} />
                </span>
                <span>{action.label}</span>
              </li>
            ))}
          </ul>

          <div className={styles.conclusionNote}>
            <Info size={14} strokeWidth={2} aria-hidden="true" />
            <p>{detail.conclusionNote}</p>
          </div>
        </aside>
      </div>

      <footer className={styles.actionsRow}>
        <button type="button" className={styles.primaryAction} onClick={handleStartMonitoring}>
          <LineChart size={14} strokeWidth={2} aria-hidden="true" />
          Запустить мониторинг рынка
        </button>
        <button type="button" className={styles.outlineAction}>
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
          Подготовить СЗ на изменение ПЦ
        </button>
        <button type="button" className={styles.outlineAction} onClick={() => navigate(PRICING_AGENT_PATH)}>
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
          Вернуть в закупку
        </button>
      </footer>
    </section>
  );
}
