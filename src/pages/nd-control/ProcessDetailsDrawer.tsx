import type { ReactNode } from "react";
import {
  AlignLeft,
  CircleDot,
  FileText,
  GitBranch,
  Layers,
  ListOrdered,
  LogIn,
  LogOut,
  Network,
  Target,
  User,
  X
} from "lucide-react";
import type { DepartmentProcessItem } from "@/types";
import styles from "../NdControlAgent.module.css";

type Props = {
  process: DepartmentProcessItem | null;
  onConfirmOwner?: (process: DepartmentProcessItem) => void;
  onOpenRelations: (processId: string, processName: string) => void;
  onDismiss?: () => void;
  onOpenDocument?: (documentId: string) => void;
  canManageDepartments: boolean;
};

function ownerBadgeClass(status: string) {
  if (status === "Подтверждён") return styles.drawerStatusOk;
  if (status === "Требует проверки") return styles.drawerStatusReview;
  return styles.drawerStatusNeutral;
}

function confidenceDotClass(level: string | null | undefined) {
  if (level === "high") return styles.confidenceDotHigh;
  if (level === "low") return styles.confidenceDotLow;
  return styles.confidenceDotMedium;
}

function DetailRow({
  icon: Icon,
  label,
  children
}: {
  icon: typeof Target;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailRowIcon} aria-hidden>
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <div className={styles.detailRowContent}>
        <span className={styles.detailRowLabel}>{label}</span>
        <div className={styles.detailRowValue}>{children}</div>
      </div>
    </div>
  );
}

function ListValue({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) return <span className={styles.detailEmpty}>{emptyLabel}</span>;
  return (
    <ul className={styles.detailList}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function ProcessDetailsDrawer({
  process,
  onConfirmOwner,
  onOpenRelations,
  onDismiss,
  onOpenDocument,
  canManageDepartments
}: Props) {
  if (!process) {
    return (
      <div className={styles.processDetailsEmpty}>
        <p>Выберите процесс в таблице.</p>
      </div>
    );
  }

  const ownerActionLabel = process.owner.candidate ? "Подтвердить владельца" : "Назначить владельца";
  const primaryDoc = process.source_documents[0];

  return (
    <div className={styles.processDrawer}>
      <header className={styles.drawerHeader}>
        <div className={styles.drawerHeaderMain}>
          <h2>{process.name}</h2>
          <span className={`${styles.drawerStatusBadge} ${ownerBadgeClass(process.owner.status_label)}`}>
            {process.owner.status_label}
          </span>
        </div>
        {onDismiss ? (
          <button type="button" className={styles.drawerCloseBtn} onClick={onDismiss} aria-label="Закрыть панель">
            <X size={18} strokeWidth={2} />
          </button>
        ) : null}
      </header>

      <div className={styles.drawerBody}>
        <DetailRow icon={Target} label="Цель">
          {process.goal ?? <span className={styles.detailEmpty}>—</span>}
        </DetailRow>

        <DetailRow icon={AlignLeft} label="Описание">
          {process.description ?? <span className={styles.detailEmpty}>—</span>}
        </DetailRow>

        <DetailRow icon={User} label="Кандидат владельца">
          {process.owner.candidate ?? <span className={styles.detailEmpty}>—</span>}
        </DetailRow>

        <DetailRow icon={CircleDot} label="Статус владельца">
          {process.owner.status_label}
        </DetailRow>

        <DetailRow icon={CircleDot} label="Уверенность владельца">
          <span className={styles.confidenceValue}>
            <span className={`${styles.confidenceDot} ${confidenceDotClass(process.owner.confidence)}`} />
            {process.owner.confidence_label ?? "—"}
          </span>
        </DetailRow>

        <DetailRow icon={FileText} label="Документы-источники">
          {primaryDoc ? (
            <button
              type="button"
              className={styles.detailLinkBtn}
              onClick={() => onOpenDocument?.(primaryDoc.document_id)}
            >
              {primaryDoc.document_code ?? primaryDoc.display_name}
            </button>
          ) : (
            <span className={styles.detailEmpty}>Не найдено в документах</span>
          )}
        </DetailRow>

        <DetailRow icon={LogIn} label="Входы">
          <ListValue items={process.inputs} emptyLabel="Не найдено в документах" />
        </DetailRow>

        <DetailRow icon={LogOut} label="Выходы">
          <ListValue items={process.outputs} emptyLabel="Не найдено в документах" />
        </DetailRow>

        <DetailRow icon={ListOrdered} label="Действия процесса">
          {process.actions.length ? (
            <ol className={styles.detailOrderedList}>
              {process.actions.map((action, index) => (
                <li key={`${action.name}-${index}`}>{action.name}</li>
              ))}
            </ol>
          ) : (
            <span className={styles.detailEmpty}>Не найдено в документах</span>
          )}
        </DetailRow>

        <DetailRow icon={Layers} label="Формы">
          <ListValue items={process.forms} emptyLabel="Не найдено в документах" />
        </DetailRow>

        <DetailRow icon={Network} label="Системы и ресурсы">
          <ListValue items={[...process.systems, ...process.resources]} emptyLabel="Не найдено в документах" />
        </DetailRow>

        <DetailRow icon={GitBranch} label="Связи">
          <span>
            Всего: {process.relations_summary.total} · подтверждённых: {process.relations_summary.confirmed} ·
            неподтверждённых: {process.relations_summary.unconfirmed}
          </span>
        </DetailRow>
      </div>

      <footer className={styles.drawerFooter}>
        {canManageDepartments && !process.owner.confirmed && onConfirmOwner ? (
          <button type="button" className={styles.drawerPrimaryBtn} onClick={() => onConfirmOwner(process)}>
            {ownerActionLabel}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.drawerSecondaryBtn}
          onClick={() => onOpenRelations(process.process_id, process.name)}
        >
          <Network size={16} strokeWidth={2} aria-hidden />
          Открыть связи процесса
        </button>
      </footer>
    </div>
  );
}
