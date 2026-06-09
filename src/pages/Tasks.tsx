import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, CheckCircle2, CircleDashed } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { onecTasksApi } from "@/api/onecEndpoints";
import { tasksApi } from "@/api/endpoints";
import LoadingPanel from "@/components/LoadingPanel";
import type { OneCTask } from "@/types";
import styles from "./Tasks.module.css";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function OneCTasksTable({ tasks }: { tasks: OneCTask[] }) {
  return (
    <div className={styles.table} role="table" aria-label="Задачи из 1С">
      <div className={styles.tableHead} role="row">
        <span role="columnheader">Задача</span>
        <span role="columnheader">Срок</span>
        <span role="columnheader">Создана</span>
        <span role="columnheader">Статус</span>
      </div>
      {tasks.map((task) => (
        <article className={styles.tableRow} key={task.id} role="row">
          <div className={styles.taskMain} role="cell">
            <span className={`${styles.taskIcon} ${task.completed ? styles.done : styles.active}`}>
              {task.completed ? (
                <CheckCircle2 size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <CircleDashed size={18} strokeWidth={2} aria-hidden="true" />
              )}
            </span>
            <div>
              <strong>{task.title}</strong>
              {task.description ? <p>{task.description}</p> : null}
            </div>
          </div>
          <span className={styles.metaCell} role="cell">
            <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
            {formatDate(task.due_date)}
          </span>
          <span className={styles.metaCell} role="cell">{formatDate(task.created_at)}</span>
          <span role="cell">
            <span className={`${styles.statusBadge} ${task.completed ? styles.statusDone : styles.statusActive}`}>
              {task.completed ? "Выполнена" : "Активна"}
            </span>
          </span>
        </article>
      ))}
    </div>
  );
}

export default function Tasks() {
  const { authMode, hasOneCAccess } = useAuth();
  const showOneCTasks = hasOneCAccess;

  const onecQuery = useQuery({
    queryKey: ["onec", "tasks"],
    queryFn: onecTasksApi.list,
    enabled: showOneCTasks,
    retry: false
  });

  const platformQuery = useQuery({
    queryKey: ["tasks", "list"],
    queryFn: () => tasksApi.list(),
    enabled: authMode === "platform" && !showOneCTasks,
    retry: 1
  });

  if (showOneCTasks) {
    if (onecQuery.isPending) {
      return (
        <LoadingPanel
          title="Загружаем задачи из 1С"
          subtitle="OData-запрос может занять 8–15 секунд. Пожалуйста, подождите."
        />
      );
    }

    if (onecQuery.isError) {
      return (
        <div className={styles.errorCard}>
          <AlertCircle size={22} strokeWidth={2} aria-hidden="true" />
          <div>
            <strong>Не удалось загрузить задачи из 1С</strong>
            <p>Проверьте доступность сервера 1С и повторите попытку.</p>
          </div>
        </div>
      );
    }

    const tasks = onecQuery.data?.tasks ?? [];

    return (
      <section className={styles.page}>
        <header className={styles.header}>
          <div>
            <h2>Мои задачи</h2>
            <p>
              {onecQuery.data?.resolved_user || "Пользователь 1С"} · найдено {onecQuery.data?.count ?? tasks.length}
              {onecQuery.data?.cached ? " · из кэша" : ""}
            </p>
          </div>
        </header>

        {!tasks.length ? (
          <div className={styles.emptyCard}>Активных задач в 1С не найдено.</div>
        ) : (
          <OneCTasksTable tasks={tasks} />
        )}
      </section>
    );
  }

  if (platformQuery.isPending) {
    return <LoadingPanel title="Загружаем задачи платформы" />;
  }

  if (platformQuery.isError) {
    return <div className={styles.errorCard}>Не удалось загрузить задачи платформы.</div>;
  }

  const data = platformQuery.data ?? [];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2>Задачи оркестратора</h2>
          <p>Задачи агентов платформы</p>
        </div>
      </header>

      {!data.length ? (
        <div className={styles.emptyCard}>Задач пока нет.</div>
      ) : (
        <div className={styles.legacyTable}>
          <table>
            <tbody>
              {data.map((task) => (
                <tr key={task.id}>
                  <td>
                    {task.title}
                    {task.description ? (
                      <>
                        <br />
                        <small>{task.description}</small>
                      </>
                    ) : null}
                  </td>
                  <td>{task.status}</td>
                  <td>
                    {task.agent_id ? <small>agent: {task.agent_id.slice(0, 8)}…</small> : null}
                    {task.celery_task_id ? (
                      <>
                        <br />
                        <small>celery: {task.celery_task_id.slice(0, 8)}…</small>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
