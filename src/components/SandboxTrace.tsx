import WorkflowGraphView from "@/components/WorkflowGraphView";
import type { SandboxRun, SandboxStep } from "@/types";
import styles from "./SandboxTrace.module.css";

const STATUS_LABELS: Record<string, string> = {
  completed: "Выполнено",
  running: "Выполняется",
  failed: "Ошибка",
  pending: "Ожидание"
};

function formatDuration(ms?: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toFixed(1)} сек`;
}

function formatBytes(bytes?: unknown): string | null {
  if (typeof bytes !== "number") return null;
  if (bytes < 1024) return `${bytes} Б`;
  return `${(bytes / 1024).toFixed(1)} КБ`;
}

function StepDetails({ step }: { step: SandboxStep }) {
  const summary = (step.result_summary ?? {}) as Record<string, unknown>;
  const request = (step.request ?? {}) as Record<string, unknown>;
  const url = (summary.url ?? request.url) as string | undefined;
  const bytes = formatBytes(summary.bytes);
  const rows: string[] = [];
  if (bytes) rows.push(`получено ${bytes} текста`);
  if (typeof summary.results_count === "number") rows.push(`найдено результатов: ${summary.results_count}`);
  if (typeof summary.items_count === "number") rows.push(`элементов: ${summary.items_count}`);
  if (typeof summary.date === "string") rows.push(`дата: ${summary.date}`);
  if (typeof summary.title === "string") rows.push(`заголовок: ${summary.title}`);
  if (typeof summary.status === "string") rows.push(`статус: ${summary.status}`);

  return (
    <div className={styles.stepDetails}>
      {url ? (
        <div className={styles.detailRow}>
          URL:{" "}
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </div>
      ) : null}
      {rows.map((row) => (
        <div key={row} className={styles.detailRow}>
          {row}
        </div>
      ))}
      {step.error_message ? <div className={styles.detailError}>{step.error_message}</div> : null}
      {typeof summary.preview === "string" && summary.preview ? (
        <pre className={styles.detailPreview}>{summary.preview}</pre>
      ) : null}
    </div>
  );
}

export default function SandboxTrace({ run }: { run: SandboxRun }) {
  const stats = run.stats ?? {};
  const isRunning = run.status === "running" || run.status === "pending";
  const steps = [...(run.steps ?? [])].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className={styles.container}>
      <div className={styles.statusHeader}>
        <span className={`${styles.statusPill} ${styles[`status_${run.status}`] ?? ""}`}>
          {STATUS_LABELS[run.status] ?? run.status}
        </span>
        {isRunning ? <span className={styles.spinner}>Агент выполняет шаги…</span> : null}
      </div>

      {run.error_message ? <div className={styles.runError}>{run.error_message}</div> : null}

      <h4 className={styles.sectionTitle}>Трассировка выполнения</h4>
      {steps.length ? (
        <ol className={styles.trace}>
          {steps.map((step) => (
            <li key={step.id} className={`${styles.step} ${styles[`step_${step.status}`] ?? ""}`}>
              <div className={styles.stepHead}>
                <span className={styles.stepOrder}>Шаг {step.order_index}</span>
                <span className={styles.stepTool}>{step.tool_name ?? step.title}</span>
                <span className={styles.stepStatus}>{STATUS_LABELS[step.status] ?? step.status}</span>
                <span className={styles.stepTime}>{formatDuration(step.duration_ms)}</span>
              </div>
              <StepDetails step={step} />
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.empty}>{isRunning ? "Ожидание первых шагов…" : "Шаги не выполнялись."}</div>
      )}

      {!isRunning ? (
        <div className={styles.analysis}>
          <h4 className={styles.sectionTitle}>Анализ выполнения</h4>
          <div className={styles.analysisGrid}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{stats.total_steps ?? steps.length}</span>
              <span className={styles.metricLabel}>Всего шагов</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{stats.success_steps ?? 0}</span>
              <span className={styles.metricLabel}>Успешно</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{stats.error_steps ?? 0}</span>
              <span className={styles.metricLabel}>Ошибок</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{formatDuration(stats.avg_duration_ms)}</span>
              <span className={styles.metricLabel}>Среднее время</span>
            </div>
          </div>
        </div>
      ) : null}

      {run.executed_graph?.nodes?.length ? (
        <div className={styles.graphSection}>
          <h4 className={styles.sectionTitle}>Фактический граф выполнения</h4>
          <WorkflowGraphView nodes={run.executed_graph.nodes} edges={run.executed_graph.edges} />
        </div>
      ) : null}

      {run.final_answer ? (
        <div className={styles.answer}>
          <h4 className={styles.sectionTitle}>Ответ агента</h4>
          <pre className={styles.answerText}>{run.final_answer}</pre>
        </div>
      ) : null}
    </div>
  );
}
