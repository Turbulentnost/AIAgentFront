import { AlertTriangle, Check, CircleX, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { ShiftResultEvalState } from "./shiftAssignmentProgress";
import styles from "./ShiftEvalIndicator.module.css";

type Props = {
  evalState?: ShiftResultEvalState;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
};

function resolveTitle(evalState: ShiftResultEvalState | undefined, title?: string): string | undefined {
  if (title) return title;
  if (!evalState) return undefined;
  if (evalState.loading) return "Проверка ответа…";
  if (evalState.error) return evalState.error;
  if (evalState.status === "resolved") return evalState.comment || "Задание выполнено";
  if (evalState.status === "partial") return evalState.comment || "Задание выполнено частично";
  if (evalState.status === "not_resolved") return evalState.comment || "Задание не выполнено";
  return evalState.comment;
}

export default function ShiftEvalIndicator({ evalState, size = "md", className, title }: Props) {
  const sizeClass = size === "sm" ? styles.sizeSm : size === "lg" ? styles.sizeLg : styles.sizeMd;
  const iconSize = size === "sm" ? 14 : size === "lg" ? 20 : 18;
  const statusTitle = resolveTitle(evalState, title);

  let toneClass = styles.toneIdle;
  let content: ReactNode = null;

  if (evalState?.loading) {
    toneClass = styles.toneLoading;
    content = <Loader2 size={iconSize} className={styles.spinner} aria-hidden />;
  } else if (evalState?.status === "resolved") {
    toneClass = styles.toneResolved;
    content = <Check size={iconSize} strokeWidth={2.5} className={styles.icon} aria-hidden />;
  } else if (evalState?.status === "partial") {
    toneClass = styles.tonePartial;
    content = <AlertTriangle size={iconSize} strokeWidth={2.25} className={styles.icon} aria-hidden />;
  } else if (evalState?.status === "not_resolved") {
    toneClass = styles.toneNotResolved;
    content = <CircleX size={iconSize} strokeWidth={2.25} className={styles.icon} aria-hidden />;
  } else if (evalState?.error) {
    toneClass = styles.toneError;
    content = <AlertTriangle size={iconSize} strokeWidth={2.25} className={styles.icon} aria-hidden />;
  }

  if (!content) return null;

  const ariaLabel =
    evalState?.loading
      ? "Проверка"
      : evalState?.status === "resolved"
        ? "Выполнено"
        : evalState?.status === "partial"
          ? "Частично"
          : evalState?.status === "not_resolved"
            ? "Не выполнено"
            : evalState?.error
              ? "Ошибка проверки"
              : "Статус";

  return (
    <span
      className={`${styles.indicator} ${sizeClass} ${toneClass} ${className ?? ""}`.trim()}
      title={statusTitle}
      aria-label={ariaLabel}
      role="img"
    >
      {content}
    </span>
  );
}
