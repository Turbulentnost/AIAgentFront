import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, Clock3, Loader2, TriangleAlert } from "lucide-react";
import { taskCompletingAgentApi } from "@/api/endpoints";
import type { TaskCompletingDatasetTask } from "@/types";
import styles from "./TaskCompletingAgent.module.css";

const progressSteps = [
  "Подготовка задачи",
  "Отправка комментария в Claude",
  "Анализ соответствия результата",
  "Сохранение статуса проверки"
] as const;

function executionComment(task: TaskCompletingDatasetTask) {
  return task.execution_result?.raw?.trim() || "Комментарий о выполнении отсутствует";
}

function resultStatus(task: TaskCompletingDatasetTask) {
  const result = task.agent_check as { findings?: { source?: string }[]; requires_human_review?: boolean } | null;
  const source = result?.findings?.[0]?.source;
  if (task.is_archived) return { label: "Архив", tone: "success" as const };
  if (!task.is_checked) return { label: "Не проверено", tone: "pending" as const };
  if (source === "relevant" && !result?.requires_human_review) return { label: "Принято", tone: "success" as const };
  return { label: "Нужна проверка", tone: "warning" as const };
}

function agentSummary(task: TaskCompletingDatasetTask) {
  const summary = task.agent_check?.summary;
  return typeof summary === "string" && summary.trim() ? summary : null;
}

export default function TaskCompletingAgent() {
  const queryClient = useQueryClient();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const { data, isError, isPending } = useQuery({
    queryKey: ["task-compliting", "tasks"],
    queryFn: taskCompletingAgentApi.tasks
  });

  const checkMutation = useMutation({
    mutationFn: taskCompletingAgentApi.checkTask,
    onMutate: (taskId) => {
      setExpandedTaskId(taskId);
      setProgressIndex(0);
    },
    onSuccess: async () => {
      setProgressIndex(progressSteps.length - 1);
      await queryClient.invalidateQueries({ queryKey: ["task-compliting", "tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task-compliting", "tasks", "summary"] });
    }
  });

  useEffect(() => {
    if (!checkMutation.isPending) return;
    const intervalId = window.setInterval(() => {
      setProgressIndex((current) => Math.min(current + 1, progressSteps.length - 2));
    }, 850);
    return () => window.clearInterval(intervalId);
  }, [checkMutation.isPending]);

  const selectedTask = useMemo(
    () => data?.active.find((task) => task.id === expandedTaskId) ?? data?.archived.find((task) => task.id === expandedTaskId),
    [data, expandedTaskId]
  );

  if (isPending) return <div className="card">Загружаем задачи агента...</div>;
  if (isError || !data) return <div className="card">Не удалось загрузить задачи агента</div>;

  return (
    <section className={styles.page} aria-labelledby="task-completing-title">
      <header className={styles.hero}>
        <div>
          <p>Агент контроля исполнения задач</p>
          <h1 id="task-completing-title">Проверка задач Светланы Соломичевой</h1>
          <span>Источник MVP: JSON-датасет. Все записи относятся к задачам Светланы Соломичевой.</span>
        </div>
        <div className={styles.summaryGrid} aria-label="Сводка задач">
          <strong>{data.active.length}<span>на проверке</span></strong>
          <strong>{data.unchecked_count}<span>не проверены</span></strong>
          <strong>{data.archived_count}<span>в архиве</span></strong>
        </div>
      </header>

      <div className={styles.contentGrid}>
        <section className={styles.panel} aria-labelledby="active-tasks-title">
          <div className={styles.panelHead}>
            <h2 id="active-tasks-title">Активные задачи</h2>
            <span>{data.active.length}</span>
          </div>
          <div className={styles.taskTableScroll}>
            {data.active.length === 0 ? (
              <div className={styles.emptyState}>Все подходящие задачи уже проверены или перенесены в архив.</div>
            ) : (
              <table className={styles.taskTable}>
                <thead>
                  <tr>
                    <th>Документ</th>
                    <th>Задача</th>
                    <th>Исполнитель</th>
                    <th>Комментарий</th>
                    <th>Статус</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {data.active.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isExpanded={expandedTaskId === task.id}
                      isChecking={checkMutation.isPending && checkMutation.variables === task.id}
                      progressIndex={progressIndex}
                      onCheck={() => checkMutation.mutate(task.id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className={styles.panel} aria-labelledby="archive-title">
          <div className={styles.panelHead}>
            <h2 id="archive-title">Архив</h2>
            <span>{data.archived.length}</span>
          </div>
          <div className={styles.archiveList}>
            {data.archived.length === 0 ? (
              <div className={styles.emptyState}>Архив пока пуст.</div>
            ) : (
              data.archived.map((task) => (
                <article className={styles.archiveItem} key={task.id}>
                  <Archive size={16} aria-hidden="true" />
                  <div>
                    <strong>{task.task_name}</strong>
                    <small>{task.agent_check?.summary ? String(task.agent_check.summary) : "Закрыта агентом"}</small>
                  </div>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>

      {checkMutation.isError && (
        <div className={styles.errorBox}>Не удалось выполнить проверку. Проверьте доступность backend и Claude.</div>
      )}
      {checkMutation.data && selectedTask && (
        <div className={checkMutation.data.is_satisfactory ? styles.successBox : styles.warningBox}>
          {checkMutation.data.is_satisfactory
            ? "Результат удовлетворительный: задача перенесена в архив."
            : "Агент не смог закрыть задачу автоматически. Нужна ручная проверка."}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  isExpanded,
  isChecking,
  progressIndex,
  onCheck
}: {
  task: TaskCompletingDatasetTask;
  isExpanded: boolean;
  isChecking: boolean;
  progressIndex: number;
  onCheck: () => void;
}) {
  const status = resultStatus(task);
  const summary = agentSummary(task);

  return (
    <>
      <tr className={`${styles.taskRow} ${isExpanded ? styles.expanded : ""}`}>
        <td className={styles.documentCell}>
          <div className={styles.cellClamp}>{task.document || "Без документа"}</div>
        </td>
        <td className={styles.taskCell}>
          <div className={styles.taskCellContent}>
            <strong>{task.task_name}</strong>
            <small>{task.task_description || task.task || "Описание не указано"}</small>
            <small>Создана: {task.created_at || "не указано"} · Срок: {task.deadline || "не указан"}</small>
          </div>
        </td>
        <td className={styles.executorCell}>
          <div className={styles.cellClamp}>{task.executor || "Не указан"}</div>
        </td>
        <td className={styles.commentCell}>
          <div className={styles.cellClamp}>{executionComment(task)}</div>
        </td>
        <td className={styles.statusCell}>
          <span className={`${styles.statusPill} ${styles[status.tone]}`}>{status.label}</span>
        </td>
        <td className={styles.actionCell}>
          <button className={`${styles.checkButton} ${styles[status.tone]}`} type="button" onClick={onCheck} disabled={isChecking}>
            {isChecking && <Loader2 className={styles.spin} size={15} aria-hidden="true" />}
            {isChecking ? "Проверяем" : "Проверить"}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className={styles.progressRow}>
          <td colSpan={6}>
            <div className={styles.progressPanel}>
              <div className={styles.progressTitle}>
                {isChecking ? <Loader2 className={styles.spin} size={20} aria-hidden="true" /> : <Clock3 size={20} aria-hidden="true" />}
                <strong>Ход работы агента</strong>
              </div>
              <div className={styles.steps}>
                {progressSteps.map((step, index) => {
                  const done = index < progressIndex || (!isChecking && index <= progressIndex);
                  const current = isChecking && index === progressIndex;
                  return (
                    <span className={`${styles.step} ${done ? styles.done : ""} ${current ? styles.current : ""}`} key={step}>
                      {done ? <CheckCircle2 size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
                      {step}
                    </span>
                  );
                })}
              </div>
              {summary && <p className={styles.agentSummary}>{summary}</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
