import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { ShiftAssignmentMeta, ShiftAssignmentPriority } from "./shiftAssignmentTypes";
import type { ShiftTaskView } from "./shiftAssignmentProgress";
import styles from "./ShiftEndModal.module.css";

type ShiftEndStats = {
  total: number;
  resolved: number;
  incomplete: number;
  partial: number;
  notResolved: number;
  active: number;
};

type Props = {
  open: boolean;
  managerName: string;
  reportDate: string;
  meta: ShiftAssignmentMeta | null;
  tasks: ShiftTaskView[];
  stats: ShiftEndStats;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onClose: () => void;
  onSubmit: (reasons: Record<string, string>) => Promise<void>;
};

function priorityLabel(priority: ShiftAssignmentPriority): string {
  switch (priority) {
    case "urgent":
      return "Срочно";
    case "today":
      return "Сегодня";
    default:
      return "Неделя";
  }
}

function statusLabel(status: ShiftTaskView["progressStatus"]): string {
  switch (status) {
    case "resolved":
      return "Выполнено";
    case "partial":
      return "Частично";
    case "not_resolved":
      return "Не выполнено";
    default:
      return "Активно";
  }
}

function taskLine(task: ShiftTaskView): string {
  const pieces = [priorityLabel(task.priority)];
  if (task.deadline) pieces.push(task.deadline);
  if (task.deficit) pieces.push(`дефицит ${task.deficit}`);
  return pieces.join(" · ");
}

export default function ShiftEndModal({
  open,
  managerName,
  reportDate,
  meta,
  tasks,
  stats,
  submitting,
  error,
  success,
  onClose,
  onSubmit,
}: Props) {
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const resolvedTasks = useMemo(
    () => tasks.filter((task) => task.progressStatus === "resolved"),
    [tasks]
  );
  const incompleteTasks = useMemo(
    () => tasks.filter((task) => task.progressStatus !== "resolved"),
    [tasks]
  );
  const canSubmit = incompleteTasks.every((task) => (reasons[task.key] ?? "").trim());

  useEffect(() => {
    if (open) {
      setReasons({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (submitting || !canSubmit || success) return;
    await onSubmit(
      Object.fromEntries(
        incompleteTasks.map((task) => [task.key, (reasons[task.key] ?? "").trim()])
      )
    );
  };

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-end-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <p className={styles.eyebrow}>Завершение смены</p>
            <h2 id="shift-end-title" className={styles.title}>
              Отчёт за {meta?.asOf || reportDate}
            </h2>
            <p className={styles.subtitle}>
              {managerName || "Менеджер"} · неделя {meta?.weekPeriod || "—"}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={submitting}
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          {incompleteTasks.length > 0 ? (
            <div className={`${styles.notice} ${styles.noticeWarning}`} role="alert">
              <AlertTriangle size={18} aria-hidden />
              <div>
                <strong>Есть невыполненные задания</strong>
                <span>Заполните основание по каждому пункту перед завершением смены.</span>
              </div>
            </div>
          ) : (
            <div className={`${styles.notice} ${styles.noticeSuccess}`}>
              <CheckCircle2 size={18} aria-hidden />
              <div>
                <strong>Все задания за сегодня закрыты</strong>
                <span>Можно сформировать дневной отчёт без дополнительных оснований.</span>
              </div>
            </div>
          )}

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span>Всего сегодня</span>
              <strong>{stats.total}</strong>
            </div>
            <div className={styles.statCard}>
              <span>Выполнено</span>
              <strong className={styles.statSuccess}>{stats.resolved}</strong>
            </div>
            <div className={styles.statCard}>
              <span>Не выполнено</span>
              <strong className={styles.statDanger}>{stats.incomplete}</strong>
            </div>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3>Выполнено</h3>
              <span>{resolvedTasks.length}</span>
            </div>
            {resolvedTasks.length > 0 ? (
              <div className={styles.taskList}>
                {resolvedTasks.map((task) => (
                  <article key={task.key} className={styles.taskCard}>
                    <div>
                      <p className={styles.taskType}>{task.taskType}</p>
                      <strong>{task.nomenclature}</strong>
                      <span>{taskLine(task)}</span>
                    </div>
                    <span className={`${styles.statusBadge} ${styles.statusResolved}`}>
                      {statusLabel(task.progressStatus)}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyText}>Закрытых заданий за сегодня пока нет.</p>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3>Не выполнено</h3>
              <span>{incompleteTasks.length}</span>
            </div>
            {incompleteTasks.length > 0 ? (
              <div className={styles.taskList}>
                {incompleteTasks.map((task) => (
                  <article key={task.key} className={styles.taskCard}>
                    <div className={styles.taskCardTop}>
                      <div>
                        <p className={styles.taskType}>{task.taskType}</p>
                        <strong>{task.nomenclature}</strong>
                        <span>{taskLine(task)}</span>
                      </div>
                      <span className={`${styles.statusBadge} ${styles.statusIncomplete}`}>
                        {statusLabel(task.progressStatus)}
                      </span>
                    </div>
                    <label className={styles.reasonField}>
                      <span>Основание невыполнения</span>
                      <textarea
                        value={reasons[task.key] ?? ""}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [task.key]: event.target.value,
                          }))
                        }
                        disabled={submitting || Boolean(success)}
                        placeholder="Например: поставщик не подтвердил дату, ждём счёт, нет ответа по логистике..."
                        rows={3}
                      />
                    </label>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyText}>Невыполненных заданий за сегодня нет.</p>
            )}
          </section>

          {error ? (
            <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
              <AlertTriangle size={18} aria-hidden />
              <div>
                <strong>Не удалось завершить смену</strong>
                <span>{error}</span>
              </div>
            </div>
          ) : null}

          {success ? (
            <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status">
              <CheckCircle2 size={18} aria-hidden />
              <div>
                <strong>Смена завершена</strong>
                <span>{success}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={submitting}>
            {success ? "Закрыть" : "Отмена"}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void handleSubmit()}
            disabled={submitting || !canSubmit || Boolean(success)}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden />
                Формируем отчёт
              </>
            ) : (
              "Завершить"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
