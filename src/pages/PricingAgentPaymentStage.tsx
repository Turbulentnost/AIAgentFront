import { useNavigate } from "react-router-dom";
import {
  Building2,
  Calendar,
  CircleDollarSign,
  CheckCircle2,
  FileText,
  Minus,
  Users
} from "lucide-react";
import PricingStagePageFrame from "@/components/PricingAgent/PricingStagePageFrame";
import type { PricingPaymentStageDetail } from "@/mock-data/pricingAgent";
import { getPricingStagePath } from "@/utils/agentLaunch";
import { getPricingStageNavigationState } from "@/utils/pricingStageNavigation";
import shared from "./pricingStageShared.module.css";
import styles from "./PricingAgentPaymentStage.module.css";

export interface PricingAgentPaymentStageProps {
  detail: PricingPaymentStageDetail;
  animateConnectorIndex?: number | null;
}

const formIcons: Record<string, typeof Building2> = {
  supplier: Building2,
  amount: CircleDollarSign,
  basis: FileText,
  date: Calendar,
  urgency: Minus,
  cfo: Users,
  expense: Building2
};

export default function PricingAgentPaymentStage({
  detail,
  animateConnectorIndex = null
}: PricingAgentPaymentStageProps) {
  const navigate = useNavigate();

  const handleNext = () => {
    navigate(getPricingStagePath("settlement", detail.invoiceId), {
      state: getPricingStageNavigationState(detail.currentStep)
    });
  };

  return (
    <PricingStagePageFrame
      currentStep={detail.currentStep}
      stageTitle={detail.stageTitle}
      animateConnectorIndex={animateConnectorIndex}
    >
      <article className={styles.summaryCard}>
        <div className={styles.summarySection}>
          <span className={styles.summaryLabel}>Поставщик</span>
          <strong>
            <Building2 size={14} strokeWidth={2} aria-hidden="true" />
            {detail.supplier}
          </strong>
          <small>ИНН {detail.supplierInn}</small>
        </div>
        <div className={styles.summaryDivider} aria-hidden="true" />
        <div className={styles.summarySection}>
          <span className={styles.summaryLabel}>Счет</span>
          <strong>
            №{detail.invoiceNumber} от {detail.invoiceDate}
          </strong>
          <small>Сумма: {detail.amount}</small>
        </div>
        <button type="button" className={styles.checkButton}>
          К проверке
        </button>
      </article>

      <div className={shared.contentGrid}>
        <section className={`${shared.panel} ${styles.datePanel}`}>
          <h2 className={shared.panelTitle}>
            <Calendar size={15} strokeWidth={2} aria-hidden="true" />
            Рекомендуемая дата оплаты
          </h2>
          <p className={styles.recommendedDate}>{detail.recommendedPaymentDate}</p>
          <div className={styles.formulaRow}>
            {detail.formulaItems.map((item, index) => (
              <span key={item.id} className={styles.formulaGroup}>
                {index > 0 ? <span className={styles.formulaOp} aria-hidden="true">−</span> : null}
                <span className={styles.formulaChip}>{item.label}</span>
              </span>
            ))}
            <span className={styles.formulaOp} aria-hidden="true">=</span>
            <span className={styles.formulaResult}>{detail.formulaResult}</span>
          </div>
        </section>

        <section className={`${shared.panel} ${styles.basisPanel}`}>
          <h2 className={shared.panelTitle}>Основание</h2>
          <dl className={styles.basisList}>
            {detail.basisFields.map((field) => (
              <div key={field.id} className={styles.basisRow}>
                <dt>{field.label}</dt>
                <dd className={field.id === "urgency" ? styles.urgencyBadge : undefined}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className={`${shared.panel} ${styles.formPanel}`} aria-labelledby="payment-form-title">
        <h2 id="payment-form-title" className={shared.panelTitle}>
          Заявка на оплату
        </h2>
        <div className={styles.formGrid}>
          {detail.formFields.map((field) => {
            const Icon = formIcons[field.id] ?? FileText;
            return (
              <label key={field.id} className={styles.formField}>
                <span>{field.label}</span>
                <span className={styles.formInput}>
                  <Icon size={14} strokeWidth={2} aria-hidden="true" />
                  {field.value}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <footer className={styles.footerBar}>
        <div className={styles.limitsBox}>
          <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden="true" />
          <div>
            <strong>{detail.limitsStatus}</strong>
            <span>{detail.limitsAvailable}</span>
          </div>
        </div>
        <div className={shared.actionsRow}>
          <button type="button" className={shared.primaryAction} onClick={handleNext}>
            Передать на согласование
          </button>
          <button type="button" className={shared.outlineAction}>
            Изменить дату оплаты
          </button>
          <button type="button" className={shared.outlineAction}>
            Вернуть счет
          </button>
        </div>
      </footer>
    </PricingStagePageFrame>
  );
}
