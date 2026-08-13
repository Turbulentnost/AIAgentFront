import { Loader2, Package } from "lucide-react";
import styles from "../DocumentAnalysisAgent.module.css";

type Props = {
  mode?: "loading" | "analyzing";
};

const PERIOD_LABELS = ["За день", "За неделю", "За месяц"];
const TILE_LABELS = ["С планом", "Обеспечено", "Частично", "Не обеспечено"];

export default function CoverageDashboardLoading({ mode = "loading" }: Props) {
  const message =
    mode === "analyzing"
      ? "Считаем дашборд обеспеченности по загруженным данным…"
      : "Загружаем дашборд и при необходимости обновляем на сегодня…";

  return (
    <section
      className={`${styles.coverageBoard} ${styles.coverageBoardLoading}`}
      aria-label="Обеспеченность производства"
      aria-busy="true"
      aria-live="polite"
    >
      <div className={styles.coverageBoardHeader}>
        <div className={styles.coverageBoardIntro}>
          <div className={`${styles.coverageModeLead} ${styles.coverageModeLeadProducts}`}>
            <span className={styles.coverageModeLeadIcon} aria-hidden="true">
              <Package size={18} strokeWidth={2.2} />
            </span>
            <div className={styles.coverageModeLeadTextWrap}>
              <h2 className={styles.coverageModeLeadTitle}>Обеспеченность производства</h2>
              <p className={styles.coverageModeLeadHint}>План, остатки и поступления по изделиям и материалам</p>
            </div>
          </div>
        </div>
        <div className={styles.coverageDashboardLoadingPeriods} aria-hidden="true">
          {PERIOD_LABELS.map((label) => (
            <span key={label} className={styles.coverageDashboardLoadingPeriod}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.coverageDashboardLoadingStatus}>
        <Loader2 size={20} className={styles.coverageDashboardLoadingSpinner} aria-hidden="true" />
        <span>{message}</span>
      </div>

      <div className={styles.coverageAnalyticsTiles} aria-hidden="true">
        {TILE_LABELS.map((label) => (
          <div key={label} className={styles.coverageDashboardLoadingTile}>
            <span className={styles.coverageDashboardLoadingTileIcon} />
            <span className={styles.coverageDashboardLoadingTileBody}>
              <span className={styles.coverageDashboardLoadingLine} data-width="short" />
              <span className={styles.coverageDashboardLoadingLine} data-width="medium" />
            </span>
          </div>
        ))}
      </div>

      <div className={styles.coverageDashboardLoadingTable} aria-hidden="true">
        <div className={styles.coverageDashboardLoadingTableHead}>
          <span className={styles.coverageDashboardLoadingLine} data-width="medium" />
          <span className={styles.coverageDashboardLoadingLine} data-width="short" />
          <span className={styles.coverageDashboardLoadingLine} data-width="short" />
          <span className={styles.coverageDashboardLoadingLine} data-width="tiny" />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.coverageDashboardLoadingTableRow}>
            <span className={styles.coverageDashboardLoadingLine} data-width="long" />
            <span className={styles.coverageDashboardLoadingLine} data-width="tiny" />
            <span className={styles.coverageDashboardLoadingLine} data-width="tiny" />
            <span className={styles.coverageDashboardLoadingLine} data-width="short" />
          </div>
        ))}
      </div>
    </section>
  );
}
