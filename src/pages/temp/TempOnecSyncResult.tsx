/** TEMP(Aveon) — компактный результат ручной выгрузки из 1С */
import styles from "./TempOnecSyncFreshness.module.css";
import type { OnecManualSyncMessageView } from "./onecSyncFreshness";

export function TempOnecSyncResult({ view }: { view: OnecManualSyncMessageView | null }) {
  if (!view) return null;

  return (
    <div className={`${styles.result} ${styles[`result_${view.tone}`]}`} role="status">
      <p className={styles.resultTitle}>{view.title}</p>
      {view.steps.length ? (
        <ul className={styles.stepList}>
          {view.steps.map((step) => (
            <li
              key={step.label}
              className={
                step.ok === true
                  ? styles.stepOk
                  : step.ok === false
                    ? styles.stepFail
                    : styles.stepUnknown
              }
            >
              <span className={styles.stepLabel}>{step.label}</span>
              <span className={styles.stepMessage}>
                {step.ok === true ? "ок" : step.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
