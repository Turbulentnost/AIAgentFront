import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DepartmentSummary } from "@/types";
import { KB_STATUS_LABELS } from "./constants";
import styles from "../NdControlAgent.module.css";

type Props = {
  summary: DepartmentSummary;
  topProcesses: Array<{
    process_id: string;
    canonical_name: string;
    owner_candidate: string | null;
    source_documents_count: number;
    relations_count: number;
    needs_review: boolean;
  }>;
  onShowAllProcesses: () => void;
  onOpenReview: () => void;
};

export default function DepartmentOverviewTab({
  summary,
  topProcesses,
  onShowAllProcesses,
  onOpenReview
}: Props) {
  const kbItems = summary.knowledge_bases as Array<{
    id: string;
    name: string;
    description?: string | null;
    documents_count?: number;
    processed_count?: number;
    status?: string;
  }>;

  return (
    <div className={styles.tabContent}>
      <section className={styles.sectionCard}>
        <h3>Базы знаний отдела</h3>
        {kbItems.length === 0 ? (
          <p className={styles.emptyHint}>К этому отделу не прикреплены базы знаний.</p>
        ) : (
          <div className={styles.kbGrid}>
            {kbItems.map((kb) => (
              <div key={kb.id} className={styles.kbCard}>
                <strong>{kb.name}</strong>
                {kb.description ? <p>{kb.description}</p> : null}
                <p>
                  Документов: {kb.documents_count ?? 0} · Обработано: {kb.processed_count ?? 0}
                </p>
                <span className={styles.miniBadge}>
                  {KB_STATUS_LABELS[kb.status ?? "pending"] ?? kb.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.metricsGrid}>
        {[
          { label: "Документы", value: summary.document_cards_count },
          { label: "Процессы", value: summary.processes_count },
          { label: "Связи", value: summary.relations_count },
          { label: "Требует проверки", value: summary.pending_review_count }
        ].map((metric) => (
          <div key={metric.label} className={styles.metricCard}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h3>Основные найденные процессы</h3>
          {summary.processes_count > 5 ? (
            <button type="button" className={styles.linkBtn} onClick={onShowAllProcesses}>
              Показать все процессы
            </button>
          ) : null}
        </div>
        {topProcesses.length === 0 ? (
          <p className={styles.emptyHint}>Процессы пока не найдены.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Процесс</th>
                  <th>Владелец</th>
                  <th>Документы</th>
                  <th>Связи</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {topProcesses.map((process) => (
                  <tr key={process.process_id}>
                    <td>{process.canonical_name}</td>
                    <td>{process.owner_candidate ?? "—"}</td>
                    <td>{process.source_documents_count}</td>
                    <td>{process.relations_count}</td>
                    <td>
                      {process.needs_review ? (
                        <span className={styles.badgeReview}>Проверка</span>
                      ) : (
                        <span className={styles.badgeOk}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.sectionCard}>
        <h3>Что нужно проверить</h3>
        {summary.pending_review_count > 0 ? (
          <div className={styles.reviewAlert}>
            <AlertTriangle size={18} />
            <div>
              <p>
                Найдено {summary.pending_review_count} элементов, требующих подтверждения. Проверьте
                владельцев процессов и связи отделов с процессами.
              </p>
              <button type="button" className={styles.secondaryBtn} onClick={onOpenReview}>
                Открыть очередь проверки
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.reviewOk}>
            <CheckCircle2 size={18} />
            <span>Все найденные связи подтверждены или не требуют проверки.</span>
          </div>
        )}
      </section>
    </div>
  );
}
