import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FilePlus,
  FileText,
  Handshake,
  LayoutGrid,
  LineChart,
  Percent,
  Search,
  Scale,
  UserRound,
  Wallet
} from "lucide-react";
import {
  mockPricingAgent,
  pricingAgentSubtitle,
  pricingInvoiceQueueCount,
  pricingInvoiceStatusLabels,
  pricingInvoices,
  pricingQuickActions,
  pricingRouteStages,
  pricingStats,
  type InvoiceStatus,
  type PricingIconKey,
  type PricingTone,
  type RouteStageId
} from "@/mock-data/pricingAgent";
import { getPricingStagePath } from "@/utils/agentLaunch";
import styles from "./PricingAgent.module.css";

const pricingIcons: Record<PricingIconKey, LucideIcon> = {
  invoice: FileText,
  grid: LayoutGrid,
  chart: LineChart,
  percent: Percent,
  user: UserRound,
  wallet: Wallet,
  file: FileText,
  trend: LineChart,
  "payment-request": FilePlus,
  overdue: Clock3,
  "invoice-stage": FileText,
  "project-price": CircleDollarSign,
  monitoring: Search,
  contract: Handshake,
  "payment-app": FilePlus,
  payment: CreditCard,
  settlement: Scale
};

const invoiceStatusTone: Record<InvoiceStatus, PricingTone> = {
  requires_decision: "amber",
  in_progress: "green",
  on_review: "blue",
  done: "mint"
};

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

export default function PricingAgent() {
  const navigate = useNavigate();
  const [activeStage, setActiveStage] = useState<RouteStageId>("monitoring");

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>{mockPricingAgent.name}</h1>
        <p>{pricingAgentSubtitle}</p>
      </header>

      <div className={styles.statsRow}>
        {pricingStats.map((stat) => (
          <article key={stat.id} className={styles.statCard}>
            <span className={`${styles.statIcon} ${styles[`tone_${stat.tone}`]}`} aria-hidden="true">
              <PricingIcon icon={stat.icon} size={22} strokeWidth={2} />
            </span>
            <div className={styles.statBody}>
              <span className={styles.statLabel}>{stat.label}</span>
              <strong className={`${styles.statValue} ${styles[`value_${stat.tone}`]}`}>{stat.value}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.contentGrid}>
        <section className={styles.panel} aria-labelledby="pricing-invoices-title">
          <div className={styles.panelHead}>
            <div className={styles.panelTitleGroup}>
              <h2 id="pricing-invoices-title">Очередь счетов</h2>
              <span className={styles.countBadge}>{pricingInvoiceQueueCount}</span>
            </div>
            <button type="button" className={styles.panelLink}>
              Все счета
              <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.invoiceList}>
            {pricingInvoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                className={styles.invoiceRow}
                onClick={() => navigate(getPricingStagePath("invoice", invoice.id))}
              >
                <span className={styles.invoiceIcon} aria-hidden="true">
                  <PricingIcon icon="invoice" size={16} />
                </span>
                <span className={styles.invoiceMain}>
                  <strong>{invoice.title}</strong>
                  <span>
                    Сумма: {invoice.amount} • от {invoice.date}
                  </span>
                </span>
                <span
                  className={`${styles.statusBadge} ${styles[`badge_${invoiceStatusTone[invoice.status]}`]}`}
                >
                  {pricingInvoiceStatusLabels[invoice.status]}
                </span>
                <span className={styles.nextStep}>
                  <span className={styles.nextStepLabel}>Следующий шаг</span>
                  <span className={styles.nextStepValue}>{invoice.nextStep}</span>
                </span>
                <ChevronRight size={16} strokeWidth={2} className={styles.rowChevron} aria-hidden="true" />
              </button>
            ))}
          </div>

          <button type="button" className={styles.showAllLink}>
            Показать все
            <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </section>

        <div className={styles.sideColumn}>
          <section className={styles.panel} aria-labelledby="pricing-quick-actions-title">
            <h2 id="pricing-quick-actions-title" className={styles.sidePanelTitle}>
              Быстрые действия
            </h2>
            <div className={styles.quickActionsList}>
              {pricingQuickActions.map((action) => (
                <button key={action.id} type="button" className={styles.quickActionRow}>
                  <span className={styles.quickActionIcon} aria-hidden="true">
                    <PricingIcon icon={action.icon} size={16} />
                  </span>
                  <span>{action.label}</span>
                  <ChevronRight size={16} strokeWidth={2} className={styles.rowChevron} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="pricing-route-title">
            <h2 id="pricing-route-title" className={styles.sidePanelTitle}>
              Этапы маршрута
            </h2>
            <div className={styles.routeFlow} role="list" aria-label="Этапы маршрута обработки счета">
              {pricingRouteStages.map((stage, index) => (
                <div key={stage.id} className={styles.routeStageWrap} role="listitem">
                  <button
                    type="button"
                    className={`${styles.routeStage} ${activeStage === stage.id ? styles.routeStageActive : ""}`}
                    aria-pressed={activeStage === stage.id}
                    onClick={() => setActiveStage(stage.id)}
                  >
                    <span className={styles.routeStageIcon} aria-hidden="true">
                      <PricingIcon icon={stage.icon} size={16} />
                    </span>
                    <span className={styles.routeStageLabel}>{stage.label}</span>
                  </button>
                  {index < pricingRouteStages.length - 1 ? (
                    <ArrowRight size={12} strokeWidth={2.2} className={styles.routeArrow} aria-hidden="true" />
                  ) : null}
                </div>
              ))}
            </div>
            <p className={styles.routeHint}>
              Нажмите на этап, чтобы увидеть детали и связанные документы.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
