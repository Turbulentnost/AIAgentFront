import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  Info,
  Minus,
  User
} from "lucide-react";
import PricingStagePageFrame from "@/components/PricingAgent/PricingStagePageFrame";
import type { PricingPaymentRequestStageDetail } from "@/mock-data/pricingAgent";
import { getPricingStagePath } from "@/utils/agentLaunch";
import { getPricingStageNavigationState } from "@/utils/pricingStageNavigation";
import shared from "./pricingStageShared.module.css";
import styles from "./PricingAgentPaymentRequestStage.module.css";

export interface PricingAgentPaymentRequestStageProps {
  detail: PricingPaymentRequestStageDetail;
  animateConnectorIndex?: number | null;
}

export default function PricingAgentPaymentRequestStage({
  detail,
  animateConnectorIndex = null
}: PricingAgentPaymentRequestStageProps) {
  const navigate = useNavigate();

  const handleNext = () => {
    navigate(getPricingStagePath("payment", detail.invoiceId), {
      state: getPricingStageNavigationState(detail.currentStep)
    });
  };

  return (
    <PricingStagePageFrame
      currentStep={detail.currentStep}
      stageTitle={detail.stageTitle}
      animateConnectorIndex={animateConnectorIndex}
    >
      <article className={shared.contextBar}>
        <div className={styles.invoiceContext}>
          <span className={styles.invoiceIcon} aria-hidden="true">
            <FileText size={18} strokeWidth={2} />
          </span>
          <div className={styles.invoiceText}>
            <strong>
              Счет №{detail.invoiceNumber} / {detail.supplier}
            </strong>
            <span>
              {detail.amount} • {detail.invoiceDate}
            </span>
          </div>
        </div>
        <span className={shared.stageBadge}>Этап {detail.currentStep} из 8</span>
      </article>

      <div className={styles.topGrid}>
        <section className={`${shared.panel} ${styles.resultPanel}`}>
          <h2 className={shared.panelTitle}>Итог этапа</h2>
          <div className={styles.resultBanner}>
            <CheckCircle2 size={28} strokeWidth={2} aria-hidden="true" />
            <div className={styles.resultBody}>
              <strong>{detail.stageResultTitle}</strong>
              <span className={styles.successBadge}>{detail.stageResultText}</span>
              <p>{detail.stageResultNote}</p>
            </div>
          </div>
        </section>

        <section className={`${shared.panel} ${styles.contractPanel}`}>
          <h2 className={shared.panelTitle}>Договор</h2>
          <dl className={styles.contractList}>
            <div className={styles.contractRow}>
              <dt>Номер договора</dt>
              <dd>{detail.contractNumber}</dd>
            </div>
            <div className={styles.contractRow}>
              <dt>Статус</dt>
              <dd>
                <span className={styles.statusActive}>{detail.contractStatus}</span>
              </dd>
            </div>
            <div className={styles.contractRow}>
              <dt>Срок действия</dt>
              <dd>{detail.contractValidUntil}</dd>
            </div>
            <div className={styles.contractRow}>
              <dt>Версия</dt>
              <dd>{detail.contractVersion}</dd>
            </div>
            <div className={styles.contractRow}>
              <dt>Вложен в карточку контрагента</dt>
              <dd className={styles.yesText}>{detail.contractAttached}</dd>
            </div>
          </dl>
        </section>

        <aside className={`${shared.panel} ${styles.fallbackPanel}`}>
          <h2 className={shared.panelTitle}>
            <Info size={15} strokeWidth={2} aria-hidden="true" />
            Если договора нет
          </h2>
          <p className={styles.fallbackHint}>
            Договор не найден или срок действия истек. Выберите дальнейшее действие.
          </p>
          <ul className={styles.fallbackList}>
            {detail.fallbackActions.map((action) => (
              <li key={action.id}>
                <button type="button" className={styles.fallbackAction}>
                  <FileText size={14} strokeWidth={2} aria-hidden="true" />
                  {action.label}
                  <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className={`${shared.panel} ${styles.checksPanel}`} aria-labelledby="contract-checks-title">
        <h2 id="contract-checks-title" className={shared.panelTitle}>
          Проверки договора
        </h2>
        <div className={styles.checksTable} role="table" aria-label="Проверки договора">
          <div className={styles.checksHead} role="row">
            <span role="columnheader">Проверка</span>
            <span role="columnheader">Результат</span>
          </div>
          {detail.contractChecks.map((row) => (
            <div key={row.id} className={styles.checksRow} role="row">
              <span role="cell">{row.label}</span>
              <span role="cell" className={row.result === "yes" ? styles.resultYes : styles.resultNo}>
                {row.result === "yes" ? (
                  <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Minus size={14} strokeWidth={2.2} aria-hidden="true" />
                )}
                {row.result === "yes" ? "Да" : "Нет"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className={shared.actionsRow}>
        <button type="button" className={shared.primaryAction} onClick={handleNext}>
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          Перейти к заявке на оплату
        </button>
        <button type="button" className={shared.outlineAction}>
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
          Запустить договорной маршрут
        </button>
        <button type="button" className={shared.outlineAction}>
          <User size={14} strokeWidth={2} aria-hidden="true" />
          Передать юристу
        </button>
      </footer>
    </PricingStagePageFrame>
  );
}
