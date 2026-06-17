import { X } from "lucide-react";
import type { DepartmentProcessItem } from "@/types";
import styles from "../NdControlAgent.module.css";

type Props = {
  process: DepartmentProcessItem | null;
  onClose: () => void;
  onConfirmOwner: (process: DepartmentProcessItem) => void;
  onOpenRelations: (processId: string, processName: string) => void;
  onOpenDocument?: (documentId: string) => void;
};

function ListBlock({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <section className={styles.drawerSection}>
      <h4>{title}</h4>
      {items.length ? (
        <ul className={styles.drawerList}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.drawerEmpty}>{emptyLabel}</p>
      )}
    </section>
  );
}

function ownerBadgeClass(status: string) {
  if (status === "Подтверждён") return styles.badgeOk;
  if (status === "Требует проверки") return styles.badgeReview;
  return styles.badgeNeutral;
}

export default function ProcessDetailsDrawer({
  process,
  onClose,
  onConfirmOwner,
  onOpenRelations,
  onOpenDocument
}: Props) {
  if (!process) return null;

  const ownerActionLabel = process.owner.candidate ? "Подтвердить владельца" : "Назначить владельца";

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <aside className={styles.processDrawer} onClick={(event) => event.stopPropagation()}>
        <header className={styles.drawerHeader}>
          <div>
            <h2>{process.name}</h2>
            <div className={styles.drawerBadges}>
              <span className={ownerBadgeClass(process.owner.status_label)}>{process.owner.status_label}</span>
              {process.owner.confidence_label ? (
                <span className={styles.badgeNeutral}>Уверенность: {process.owner.confidence_label}</span>
              ) : null}
            </div>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        <div className={styles.drawerBody}>
          <section className={styles.drawerSection}>
            <h4>Кратко</h4>
            <dl className={styles.drawerMeta}>
              <div>
                <dt>Цель</dt>
                <dd>{process.goal ?? "—"}</dd>
              </div>
              <div>
                <dt>Описание</dt>
                <dd>{process.description ?? "—"}</dd>
              </div>
              <div>
                <dt>Кандидат владельца</dt>
                <dd>{process.owner.candidate ?? "—"}</dd>
              </div>
              {process.owner.reason ? (
                <div>
                  <dt>Причина выбора владельца</dt>
                  <dd>{process.owner.reason}</dd>
                </div>
              ) : null}
              <div>
                <dt>Статус владельца</dt>
                <dd>{process.owner.status_label}</dd>
              </div>
              <div>
                <dt>Уверенность владельца</dt>
                <dd>{process.owner.confidence_label ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.drawerSection}>
            <h4>Документы-источники</h4>
            {process.source_documents.length ? (
              <ul className={styles.drawerDocList}>
                {process.source_documents.map((doc) => (
                  <li key={doc.document_id}>
                    <div className={styles.drawerDocTitle}>
                      <strong>{doc.document_code ?? "—"}</strong>
                      <span>{doc.title ?? doc.display_name}</span>
                    </div>
                    <div className={styles.drawerDocMeta}>
                      {doc.document_type ? <span>{doc.document_type}</span> : null}
                      {doc.extraction_status_label ? (
                        <span>{doc.extraction_status_label}</span>
                      ) : null}
                      {onOpenDocument ? (
                        <button type="button" className={styles.linkBtn} onClick={() => onOpenDocument(doc.document_id)}>
                          Открыть документ
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.drawerEmpty}>Не найдено в документах.</p>
            )}
          </section>

          <div className={styles.drawerTwoCol}>
            <ListBlock title="Входы" items={process.inputs} emptyLabel="Не найдено в документах." />
            <ListBlock title="Выходы" items={process.outputs} emptyLabel="Не найдено в документах." />
          </div>

          <section className={styles.drawerSection}>
            <h4>Действия процесса</h4>
            {process.actions.length ? (
              <ol className={styles.drawerActionList}>
                {process.actions.map((action, index) => (
                  <li key={`${action.name}-${index}`}>
                    <strong>{action.name}</strong>
                    {action.performer ? <div>Исполнитель: {action.performer}</div> : null}
                    {action.controller ? <div>Контролёр: {action.controller}</div> : null}
                    {action.system_or_resource ? <div>Система: {action.system_or_resource}</div> : null}
                    {action.evidence_label ? <div>Основание: {action.evidence_label}</div> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.drawerEmpty}>Не найдено в документах.</p>
            )}
          </section>

          <ListBlock title="Формы" items={process.forms} emptyLabel="Не найдено в документах." />
          <ListBlock
            title="Системы и ресурсы"
            items={[...process.systems, ...process.resources]}
            emptyLabel="Не найдено в документах."
          />

          <section className={styles.drawerSection}>
            <h4>Связи</h4>
            <dl className={styles.drawerMeta}>
              <div>
                <dt>Всего связей</dt>
                <dd>{process.relations_summary.total}</dd>
              </div>
              <div>
                <dt>Подтверждённых</dt>
                <dd>{process.relations_summary.confirmed}</dd>
              </div>
              <div>
                <dt>Неподтверждённых</dt>
                <dd>{process.relations_summary.unconfirmed}</dd>
              </div>
              <div>
                <dt>Без основания</dt>
                <dd>{process.relations_summary.without_evidence}</dd>
              </div>
            </dl>
          </section>
        </div>

        <footer className={styles.drawerFooter}>
          {!process.owner.confirmed ? (
            <button type="button" className={styles.primaryBtn} onClick={() => onConfirmOwner(process)}>
              {ownerActionLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => onOpenRelations(process.process_id, process.name)}
          >
            Открыть все связи процесса
          </button>
        </footer>
      </aside>
    </div>
  );
}
