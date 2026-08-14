/** TEMP(Aveon) — прогресс ручной выгрузки из 1С */
import { CheckCircle2, Loader2 } from "lucide-react";
import styles from "./TempOnecSyncFreshness.module.css";

export type OnecSyncProgressStep = {
  key: string;
  title: string;
  status: "pending" | "running" | "done" | "error" | string;
  message?: string;
};

export type OnecSyncProgressView = {
  running: boolean;
  owner?: string;
  started_at?: string | null;
  finished_at?: string | null;
  step?: string;
  label?: string;
  steps?: OnecSyncProgressStep[];
};

function elapsedLabel(startedAt?: string | null): string {
  if (!startedAt) return "идёт выгрузка";
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return "идёт выгрузка";
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  if (seconds < 60) return `${seconds} сек.`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} мин ${rest.toString().padStart(2, "0")} сек.`;
}

function stepClass(status: string): string {
  if (status === "done") return styles.progressStepDone;
  if (status === "running") return styles.progressStepRunning;
  if (status === "error") return styles.progressStepError;
  return styles.progressStepPending;
}

export function TempOnecSyncProgress({ progress }: { progress: OnecSyncProgressView | null }) {
  if (!progress?.running) return null;

  const steps = progress.steps ?? [];
  return (
    <div className={styles.progressCard} role="status" aria-live="polite">
      <div className={styles.progressHeader}>
        <span className={styles.progressSpinner} aria-hidden>
          <Loader2 size={15} />
        </span>
        <span className={styles.progressTitle}>
          {progress.label || "Выгружаем данные из 1С"}
        </span>
        <span className={styles.progressElapsed}>{elapsedLabel(progress.started_at)}</span>
      </div>
      <div className={styles.progressHint}>
        Можно оставить страницу открытой: данные читаются из 1С и сразу сохраняются в БД.
      </div>
      {steps.length ? (
        <ol className={styles.progressSteps}>
          {steps.map((step) => (
            <li key={step.key} className={`${styles.progressStep} ${stepClass(step.status)}`}>
              <span className={styles.progressStepIcon} aria-hidden>
                {step.status === "done" ? <CheckCircle2 size={13} /> : null}
                {step.status === "running" ? <Loader2 size={13} /> : null}
              </span>
              <span className={styles.progressStepText}>
                <span className={styles.progressStepTitle}>{step.title}</span>
                {step.message ? (
                  <span className={styles.progressStepMessage}>{step.message}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
