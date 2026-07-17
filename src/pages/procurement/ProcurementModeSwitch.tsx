import type { ProcurementDashboardView } from "@/types/procurement";
import styles from "../ProcurementAgent.module.css";

type Props = {
  mode: "bases" | "cases";
  caseView: ProcurementDashboardView;
  activeCount: number;
  processingCount: number;
  archiveCount: number;
  onModeChange: (mode: "bases" | "cases") => void;
  onCaseViewChange: (view: ProcurementDashboardView) => void;
};

export function ProcurementModeSwitch({
  mode,
  caseView,
  activeCount,
  processingCount,
  archiveCount,
  onModeChange,
  onCaseViewChange
}: Props) {
  return (
    <div className={styles.modeBlock}>
      <div className={styles.modeSwitch}>
        <button
          className={mode === "bases" ? styles.modeBtnActive : styles.modeBtn}
          onClick={() => onModeChange("bases")}
          type="button"
        >
          Актуальные основания <strong>{activeCount}</strong>
        </button>
        <button
          className={mode === "cases" ? styles.modeBtnActive : styles.modeBtn}
          onClick={() => onModeChange("cases")}
          type="button"
        >
          Кейсы <strong>{processingCount}</strong>
        </button>
      </div>
      {mode === "cases" ? (
        <div className={styles.caseViewSwitch}>
          <button
            className={caseView === "processing" ? styles.caseViewActive : styles.caseViewBtn}
            onClick={() => onCaseViewChange("processing")}
            type="button"
          >
            В работе {processingCount}
          </button>
          <button
            className={caseView === "archive" ? styles.caseViewActive : styles.caseViewBtn}
            onClick={() => onCaseViewChange("archive")}
            type="button"
          >
            Архив {archiveCount}
          </button>
        </div>
      ) : null}
    </div>
  );
}
