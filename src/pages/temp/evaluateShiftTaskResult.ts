import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import { agentsApi } from "@/api/endpoints";
import type {
  ResultEvalStatus,
  ShiftResultEvalState,
  ShiftTaskContext,
} from "./shiftAssignmentProgress";

export type EvaluateShiftTaskOutcome =
  | { outcome: "resolved" }
  | { outcome: "partial" | "not_resolved"; message: string }
  | { outcome: "error"; message: string }
  | { outcome: "empty" };

type EvaluateParams = {
  taskKey: string;
  context: ShiftTaskContext;
  text: string;
  lastEvaluatedRef: MutableRefObject<Record<string, string>>;
  setResultEvals: Dispatch<SetStateAction<Record<string, ShiftResultEvalState>>>;
  currentEval?: ShiftResultEvalState;
  onManagerResultEvaluated?: (
    context: ShiftTaskContext,
    managerResult: string,
    taskKey: string
  ) => Promise<void> | void;
};

const STATUS_FALLBACK: Record<Exclude<ResultEvalStatus, never>, string> = {
  resolved: "Ответ закрывает ключевые требования задания.",
  partial: "Есть действия, но не хватает конкретики: укажите дату, номер, статус или подтверждение.",
  not_resolved: "Ответ не показывает выполнение задания: добавьте конкретный результат, а не общие слова.",
};

export function formatEvalFeedback(
  status: "partial" | "not_resolved",
  comment?: string
): { title: string; message: string } {
  const detail = (comment ?? "").trim() || STATUS_FALLBACK[status];
  if (status === "partial") {
    return {
      title: "Результат принят частично",
      message: detail,
    };
  }
  return {
    title: "Результат не принят",
    message: detail,
  };
}

function outcomeFromEvalState(evalState?: ShiftResultEvalState): EvaluateShiftTaskOutcome {
  if (evalState?.error) {
    return { outcome: "error", message: evalState.error };
  }
  if (evalState?.status === "resolved") {
    return { outcome: "resolved" };
  }
  if (evalState?.status === "partial") {
    return { outcome: "partial", message: evalState.comment ?? STATUS_FALLBACK.partial };
  }
  if (evalState?.status === "not_resolved") {
    return {
      outcome: "not_resolved",
      message: evalState.comment ?? STATUS_FALLBACK.not_resolved,
    };
  }
  return { outcome: "empty" };
}

export async function evaluateShiftTaskResult({
  taskKey,
  context,
  text,
  lastEvaluatedRef,
  setResultEvals,
  currentEval,
  onManagerResultEvaluated,
}: EvaluateParams): Promise<EvaluateShiftTaskOutcome> {
  const trimmed = text.trim();
  if (!trimmed) {
    lastEvaluatedRef.current[taskKey] = "";
    setResultEvals((prev) => ({ ...prev, [taskKey]: {} }));
    return { outcome: "empty" };
  }

  if (lastEvaluatedRef.current[taskKey] === trimmed) {
    await onManagerResultEvaluated?.(context, trimmed, taskKey);
    return outcomeFromEvalState(currentEval);
  }

  setResultEvals((prev) => ({ ...prev, [taskKey]: { loading: true } }));

  try {
    const response = await agentsApi.evaluateShiftAssignmentResult({
      taskType: context.taskType,
      problem: context.problem,
      solution: context.solution,
      nomenclature: context.nomenclature,
      managerResult: trimmed,
    });
    lastEvaluatedRef.current[taskKey] = trimmed;
    setResultEvals((prev) => ({
      ...prev,
      [taskKey]: {
        status: response.status,
        comment: response.comment,
      },
    }));
    await onManagerResultEvaluated?.(context, trimmed, taskKey);

    if (response.status === "resolved") {
      return { outcome: "resolved" };
    }
    if (response.status === "partial") {
      return {
        outcome: "partial",
        message: response.comment.trim() || STATUS_FALLBACK.partial,
      };
    }
    return {
      outcome: "not_resolved",
      message: response.comment.trim() || STATUS_FALLBACK.not_resolved,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось проверить результат";
    setResultEvals((prev) => ({
      ...prev,
      [taskKey]: { error: message },
    }));
    return { outcome: "error", message };
  }
}
