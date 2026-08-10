import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, CircleX, Loader2, X } from "lucide-react";
import type { ShiftAssignmentPriority } from "./shiftAssignmentTypes";
import type { ShiftResultEvalState, ShiftTaskView } from "./shiftAssignmentProgress";
import ShiftEvalIndicator from "./ShiftEvalIndicator";
import ShiftResultComposer from "./ShiftResultComposer";
import {
  formatEvalFeedback,
  type EvaluateShiftTaskOutcome,
} from "./evaluateShiftTaskResult";
import styles from "./ShiftTaskCompleteModal.module.css";

type Props = {
  open: boolean;
  task: ShiftTaskView | null;
  resultText: string;
  evalState?: ShiftResultEvalState;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<EvaluateShiftTaskOutcome>;
};

type FeedbackState = {
  kind: "partial" | "not_resolved" | "error";
  title: string;
  message: string;
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

function priorityChipClass(priority: ShiftAssignmentPriority): string {
  switch (priority) {
    case "urgent":
      return styles.chipUrgent;
    case "today":
      return styles.chipToday;
    default:
      return "";
  }
}

function feedbackFromOutcome(outcome: EvaluateShiftTaskOutcome): FeedbackState | null {
  if (outcome.outcome === "partial" || outcome.outcome === "not_resolved") {
    const formatted = formatEvalFeedback(outcome.outcome, outcome.message);
    return { kind: outcome.outcome, ...formatted };
  }
  if (outcome.outcome === "error") {
    return {
      kind: "error",
      title: "Проверка не выполнена",
      message: outcome.message,
    };
  }
  return null;
}

export default function ShiftTaskCompleteModal({
  open,
  task,
  resultText,
  evalState,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const [canSubmit, setCanSubmit] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef("");

  useEffect(() => {
    if (open && task) {
      draftRef.current = resultText;
      setCanSubmit(Boolean(resultText.trim()));
      setFeedback(null);
    }
  }, [open, task?.key, resultText]);

  const composerContext = useMemo(
    () =>
      task
        ? {
            taskType: task.taskType,
            problem: task.problem,
            solution: task.solution,
            nomenclature: task.nomenclature,
          }
        : null,
    [task]
  );

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (feedback) {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [feedback]);

  if (!open || !task) return null;

  const handleSubmit = async () => {
    const text = draftRef.current;
    if (submitting || !text.trim()) return;
    setFeedback(null);
    const outcome = await onSubmit(text);
    if (outcome.outcome === "resolved") {
      window.setTimeout(() => onClose(), 420);
      return;
    }
    const nextFeedback = feedbackFromOutcome(outcome);
    if (nextFeedback) setFeedback(nextFeedback);
  };

  const handleDraftChange = (value: string) => {
    draftRef.current = value;
    const nextCanSubmit = Boolean(value.trim());
    setCanSubmit((current) => (current === nextCanSubmit ? current : nextCanSubmit));
    if (feedback) setFeedback(null);
  };

  const feedbackClass =
    feedback?.kind === "partial"
      ? styles.feedbackPartial
      : feedback?.kind === "not_resolved"
        ? styles.feedbackNotResolved
        : feedback?.kind === "error"
          ? styles.feedbackError
          : "";

  const FeedbackIcon =
    feedback?.kind === "error"
      ? AlertTriangle
      : feedback?.kind === "partial"
        ? AlertTriangle
        : CircleX;

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
        aria-labelledby="shift-task-complete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <p className={styles.eyebrow}>{task.taskType}</p>
            <h2 id="shift-task-complete-title" className={styles.title}>
              {task.nomenclature}
            </h2>
            <div className={styles.chips}>
              <span className={`${styles.chip} ${priorityChipClass(task.priority)}`}>
                {priorityLabel(task.priority)}
              </span>
              {task.deadline ? <span className={styles.chip}>до {task.deadline}</span> : null}
              {task.deficit ? <span className={styles.chip}>Дефицит: {task.deficit}</span> : null}
            </div>
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
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Проблема</p>
            <p className={styles.sectionText}>{task.problem || "—"}</p>
          </div>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Что сделать</p>
            <p className={styles.sectionText}>{task.solution || "—"}</p>
          </div>
          <div className={styles.resultSection}>
            <div className={styles.resultHead}>
              <p className={styles.sectionLabel}>Результат работы</p>
              <ShiftEvalIndicator evalState={evalState} size="md" />
            </div>
            <ShiftResultComposer
              key={task.key}
              value={resultText}
              onChange={handleDraftChange}
              context={
                composerContext ?? {
                  taskType: "",
                  problem: "",
                  solution: "",
                  nomenclature: "",
                }
              }
              disabled={submitting}
              invalid={Boolean(feedback)}
              rows={5}
            />
          </div>

          {feedback ? (
            <div
              ref={feedbackRef}
              className={`${styles.feedback} ${feedbackClass}`}
              role="alert"
              aria-live="assertive"
            >
              <span className={styles.feedbackIcon} aria-hidden>
                <FeedbackIcon size={18} strokeWidth={2.25} />
              </span>
              <div>
                <p className={styles.feedbackTitle}>{feedback.title}</p>
                <p className={styles.feedbackMessage}>{feedback.message}</p>
                {feedback.kind !== "error" ? (
                  <p className={styles.feedbackHint}>
                    Уточните ответ по пунктам из «Что сделать» и отправьте снова.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={submitting}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void handleSubmit()}
            disabled={submitting || !canSubmit}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden />
                Проверка…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} aria-hidden />
                Сохранить и проверить
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
