import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
  Info,
  Mail,
  Pencil,
  Play,
  User,
  Users
} from "lucide-react";
import PricingStagePageFrame from "@/components/PricingAgent/PricingStagePageFrame";
import {
  approvalRouteStatusLabels,
  type ApprovalRouteStatus,
  type PricingContractStageDetail,
  type PricingTone
} from "@/mock-data/pricingAgent";
import { getPricingStagePath } from "@/utils/agentLaunch";
import { getPricingStageNavigationState } from "@/utils/pricingStageNavigation";
import shared from "./pricingStageShared.module.css";
import styles from "./PricingAgentContractStage.module.css";

export interface PricingAgentContractStageProps {
  detail: PricingContractStageDetail;
  animateConnectorIndex?: number | null;
}

const tileToneClass: Record<PricingTone, string> = {
  blue: styles.tileBlue,
  green: styles.tileGreen,
  violet: styles.tileViolet,
  amber: styles.tileAmber,
  mint: styles.tileMint
};

const routeStatusClass: Record<ApprovalRouteStatus, string> = {
  approved: styles.routeApproved,
  in_progress: styles.routeInProgress,
  pending: styles.routePending
};

function AttachmentIcon({ type }: { type: "pdf" | "xlsx" | "eml" }) {
  if (type === "xlsx") return <FileSpreadsheet size={14} strokeWidth={2} aria-hidden="true" />;
  if (type === "eml") return <Mail size={14} strokeWidth={2} aria-hidden="true" />;
  return <FileText size={14} strokeWidth={2} aria-hidden="true" />;
}

export default function PricingAgentContractStage({
  detail,
  animateConnectorIndex = null
}: PricingAgentContractStageProps) {
  const navigate = useNavigate();

  const handleNext = () => {
    navigate(getPricingStagePath("payment_request", detail.invoiceId), {
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
        <div className={styles.contextMain}>
          <span className={styles.contextIcon} aria-hidden="true">
            <FileText size={18} strokeWidth={2} />
          </span>
          <div className={styles.contextText}>
            <strong>{detail.supplier}</strong>
            <span>
              Счет №{detail.invoiceNumber} от {detail.invoiceDate} • Договор №{detail.contractNumber} от{" "}
              {detail.contractDate}
            </span>
          </div>
        </div>
        <div className={styles.contextMeta}>
          <span className={shared.stageBadge}>Этап {detail.currentStep} из 8</span>
          <span className={styles.responsible}>
            <User size={13} strokeWidth={2} aria-hidden="true" />
            {detail.responsibleAgent}
          </span>
        </div>
      </article>

      <div className={shared.contentGrid}>
        <section className={`${shared.panel} ${styles.reasonPanel}`}>
          <h2 className={shared.panelTitle}>
            <Info size={15} strokeWidth={2} aria-hidden="true" />
            Причина изменения
          </h2>
          <p className={styles.reasonText}>{detail.changeReason}</p>
          <div className={styles.priceTileRow}>
            {detail.priceTiles.map((tile) => (
              <article key={tile.id} className={`${styles.priceTile} ${tileToneClass[tile.tone]}`}>
                <span className={styles.priceTileIcon} aria-hidden="true">
                  {tile.id === "date" ? (
                    <Calendar size={14} strokeWidth={2} />
                  ) : (
                    <CircleDollarSign size={14} strokeWidth={2} />
                  )}
                </span>
                <span className={styles.priceTileLabel}>{tile.label}</span>
                <strong className={styles.priceTileValue}>{tile.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className={`${shared.panel} ${styles.routePanel}`}>
          <h2 className={shared.panelTitle}>
            <Users size={15} strokeWidth={2} aria-hidden="true" />
            Маршрут согласования
          </h2>
          <ol className={styles.routeList}>
            {detail.approvalRoute.map((step) => (
              <li key={step.id} className={`${styles.routeItem} ${routeStatusClass[step.status]}`}>
                <span className={styles.routeDot} aria-hidden="true" />
                <div className={styles.routeBody}>
                  <strong>{step.role}</strong>
                  <span>{approvalRouteStatusLabels[step.status]}</span>
                  {step.detail ? <small>{step.detail}</small> : null}
                  {step.timestamp ? <time>{step.timestamp}</time> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className={`${shared.panel} ${styles.memoPanel}`} aria-labelledby="memo-title">
        <h2 id="memo-title" className={shared.panelTitle}>
          Содержимое СЗ
        </h2>
        <div className={styles.memoGrid}>
          <div className={styles.memoSummary}>
            <div className={styles.memoMetric}>
              <span>Старая проектная цена</span>
              <strong>{detail.memoOldPrice}</strong>
            </div>
            <div className={styles.memoMetric}>
              <span>Новая проектная цена</span>
              <strong>{detail.memoNewPrice}</strong>
            </div>
            <div className={styles.memoMetric}>
              <span>Изменение, %</span>
              <strong className={styles.memoPercent}>{detail.memoChangePercent}</strong>
            </div>
          </div>
          <div className={styles.memoDetails}>
            <div className={styles.memoField}>
              <span>Причина изменения</span>
              <p>{detail.memoChangeReason}</p>
            </div>
            <div className={styles.memoField}>
              <span>Приложения</span>
              <ul className={styles.attachmentList}>
                {detail.memoAttachments.map((file) => (
                  <li key={file.id} className={`${styles.attachmentChip} ${styles[`attachment_${file.type}`]}`}>
                    <AttachmentIcon type={file.type} />
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.memoField}>
              <span>Комментарии</span>
              <p>{detail.memoComment}</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={shared.actionsRow}>
        <button type="button" className={shared.primaryAction} onClick={handleNext}>
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
          Сформировать СЗ
        </button>
        <button type="button" className={shared.outlineAction}>
          <Play size={14} strokeWidth={2} aria-hidden="true" />
          Запустить согласование
        </button>
        <button type="button" className={shared.ghostAction}>
          <Pencil size={14} strokeWidth={2} aria-hidden="true" />
          Редактировать текст
        </button>
      </footer>
    </PricingStagePageFrame>
  );
}
