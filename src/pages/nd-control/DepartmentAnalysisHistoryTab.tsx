import { useQuery } from "@tanstack/react-query";
import { ndControlApi } from "@/api/endpoints";
import { formatDateTime, formatDuration } from "./utils";
import styles from "../NdControlAgent.module.css";

type Props = {
  departmentId: string;
  onReanalyze: () => void;
};

export default function DepartmentAnalysisHistoryTab({ departmentId, onReanalyze }: Props) {
  const runs = useQuery({
    queryKey: ["nd-control", "analysis-runs", departmentId],
    queryFn: () => ndControlApi.listDepartmentAnalysisRuns(departmentId, { page: 1, size: 20 }),
    enabled: Boolean(departmentId)
  });

  if (runs.isLoading) return <p className={styles.emptyHint}>Загрузка истории…</p>;
  if (!runs.data?.items.length) {
    return (
      <div className={styles.emptyStateBlock}>
        <p>Анализ для этого отдела ещё не запускался.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Запуск</th>
            <th>Завершение</th>
            <th>Статус</th>
            <th>Документы</th>
            <th>Ошибки</th>
            <th>Needs review</th>
            <th>Процессы</th>
            <th>Связи</th>
            <th>Длительность</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {runs.data.items.map((run) => (
            <tr key={run.run_id}>
              <td>{formatDateTime(run.started_at)}</td>
              <td>{formatDateTime(run.finished_at)}</td>
              <td>{run.status}</td>
              <td>
                {run.processed_documents}/{run.total_documents}
              </td>
              <td>{run.failed_documents}</td>
              <td>{run.needs_review_documents}</td>
              <td>{run.processes_created}</td>
              <td>{run.relations_created}</td>
              <td>{formatDuration(run.duration_seconds)}</td>
              <td className={styles.actionsCell}>
                <button type="button" className={styles.linkBtn} onClick={onReanalyze}>
                  Повторить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {runs.data.items.some((run) => run.error_message) ? (
        <div className={styles.sectionCard}>
          <h3>Последняя ошибка</h3>
          <p>{runs.data.items.find((run) => run.error_message)?.error_message}</p>
        </div>
      ) : null}
    </div>
  );
}
