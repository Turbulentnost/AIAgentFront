import { AlertTriangle, Loader2 } from "lucide-react";
import type { DepartmentAnalysisStatus } from "@/types";
import { ANALYSIS_STEP_LABELS } from "./constants";
import styles from "../NdControlAgent.module.css";

type Props = {
  status: DepartmentAnalysisStatus | undefined;
  isLoading: boolean;
};

export default function DepartmentAnalysisProgress({ status, isLoading }: Props) {
  const progress = status?.progress_percent ?? 0;
  const processed =
    (status?.processed_documents ?? 0) +
    (status?.skipped_documents ?? 0) +
    (status?.failed_documents ?? 0) +
    (status?.needs_review_documents ?? 0);
  const total = status?.total_documents ?? 0;
  const stepKey = status?.current_step ?? "initializing";
  const stepLabel = ANALYSIS_STEP_LABELS[stepKey] ?? status?.message ?? "Анализ выполняется…";

  return (
    <div className={styles.analysisPanel}>
      <div className={styles.analysisSpinnerWrap} aria-hidden="true">
        <Loader2 size={40} className={styles.analysisSpinner} />
      </div>
      <h2 className={styles.analysisTitle}>
        {isLoading && !status?.message ? "Анализ запускается…" : stepLabel}
      </h2>
      <p className={styles.analysisHint}>
        Анализ выполняется в фоне. Можно оставить страницу открытой — прогресс обновится автоматически.
      </p>
      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressFill} style={{ width: `${Math.max(progress, 4)}%` }} />
      </div>
      <div className={styles.analysisStatsGrid}>
        <div>
          <span>Прогресс</span>
          <strong>{progress}%</strong>
        </div>
        <div>
          <span>Обработано</span>
          <strong>
            {total ? `${processed} из ${total}` : "подготовка…"}
          </strong>
        </div>
        <div>
          <span>Ошибок</span>
          <strong>{status?.failed_documents ?? 0}</strong>
        </div>
        <div>
          <span>Требуют проверки</span>
          <strong>{status?.needs_review_documents ?? 0}</strong>
        </div>
      </div>
      {status?.status === "failed" ? (
        <div className={styles.analysisErrorInline}>
          <AlertTriangle size={16} />
          <span>{status.message ?? "Не удалось завершить анализ"}</span>
        </div>
      ) : null}
    </div>
  );
}
