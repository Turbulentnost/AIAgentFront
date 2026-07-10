import {
  AlertTriangle,
  Building2,
  FileText,
  RefreshCw,
  User,
  Wallet,
  X
} from "lucide-react";
import PricingStagePageFrame from "@/components/PricingAgent/PricingStagePageFrame";
import type { PricingCompletionStageDetail, SettlementCheckStatus } from "@/mock-data/pricingAgent";
import shared from "./pricingStageShared.module.css";
import styles from "./PricingAgentCompletionStage.module.css";

export interface PricingAgentCompletionStageProps {
  detail: PricingCompletionStageDetail;
  animateConnectorIndex?: number | null;
}

const checkStatusClass: Record<SettlementCheckStatus, string> = {
  waiting: styles.statusWaiting,
  no: styles.statusNo,
  yes: styles.statusYes
};

export default function PricingAgentCompletionStage({
  detail,
  animateConnectorIndex = null
}: PricingAgentCompletionStageProps) {
  return (
    <PricingStagePageFrame
      currentStep={detail.currentStep}
      stageTitle={detail.stageTitle}
      animateConnectorIndex={animateConnectorIndex}
    >
      <article className={styles.processBar}>
        <div className={styles.processItem}>
          <Building2 size={14} strokeWidth={2} aria-hidden="true" />
          <span>{detail.supplier}</span>
        </div>
        <div className={styles.processItem}>
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
          <span>
            Счет №{detail.invoiceNumber} / 000 от {detail.invoiceDate}
          </span>
        </div>
        <div className={styles.processItem}>
          <span>{detail.amount}</span>
        </div>
        <div className={styles.processItem}>
          <span>{detail.processId}</span>
        </div>
      </article>

      <div className={styles.topRow}>
        <section className={`${shared.panel} ${styles.statusPanel}`}>
          <span className={styles.statusIcon} aria-hidden="true">
            <Wallet size={20} strokeWidth={2} />
          </span>
          <div>
            <h2 className={styles.statusTitle}>{detail.settlementStatus}</h2>
            <p className={styles.statusDescription}>{detail.settlementDescription}</p>
          </div>
        </section>

        <div className={styles.indicatorRow}>
          <article className={styles.indicatorCard}>
            <Wallet size={16} strokeWidth={2} aria-hidden="true" />
            <span>Незакрытые авансы</span>
            <strong>{detail.unclosedAdvances}</strong>
          </article>
          <article className={styles.indicatorCard}>
            <FileText size={16} strokeWidth={2} aria-hidden="true" />
            <span>Закрывающие документы</span>
            <strong>{detail.closingDocuments}</strong>
          </article>
          <article className={styles.indicatorCard}>
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            <span>Требуют действия</span>
            <strong>{detail.actionsRequired}</strong>
          </article>
        </div>
      </div>

      <div className={shared.contentGrid}>
        <section className={`${shared.panel} ${styles.checksPanel}`} aria-labelledby="settlement-checks-title">
          <h2 id="settlement-checks-title" className={shared.panelTitle}>
            Контроль взаиморасчетов
          </h2>
          <div className={styles.checksTable} role="table" aria-label="Контроль взаиморасчетов">
            <div className={styles.checksHead} role="row">
              <span role="columnheader">Проверка</span>
              <span role="columnheader">Статус</span>
              <span role="columnheader">Комментарий</span>
            </div>
            {detail.checks.map((row) => (
              <div key={row.id} className={styles.checksRow} role="row">
                <span role="cell" className={styles.checkLabel}>
                  <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
                  {row.label}
                </span>
                <span role="cell">
                  <span className={`${styles.statusPill} ${checkStatusClass[row.status]}`}>
                    {row.status === "no" ? (
                      <X size={12} strokeWidth={2.2} aria-hidden="true" />
                    ) : row.status === "yes" ? (
                      <AlertTriangle size={12} strokeWidth={2.2} aria-hidden="true" />
                    ) : null}
                    {row.statusLabel}
                  </span>
                </span>
                <span role="cell" className={styles.checkComment}>
                  {row.comment}
                </span>
              </div>
            ))}
          </div>
        </section>

        <aside className={`${shared.panel} ${styles.recommendPanel}`}>
          <h2 className={shared.panelTitle}>Рекомендуемое действие</h2>
          <p className={styles.recommendText}>{detail.recommendation}</p>
          <div className={styles.recommendActions}>
            <button type="button" className={shared.primaryAction}>
              Закрыть карточку
            </button>
            <button type="button" className={shared.outlineAction}>
              <FileText size={14} strokeWidth={2} aria-hidden="true" />
              Подготовить претензию
            </button>
            <button type="button" className={shared.outlineAction}>
              <User size={14} strokeWidth={2} aria-hidden="true" />
              Передать юристу
            </button>
          </div>
        </aside>
      </div>
    </PricingStagePageFrame>
  );
}
