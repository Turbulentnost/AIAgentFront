import { useState, type FormEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { ProcurementDashboardView } from "@/types/procurement";
import styles from "../ProcurementAgent.module.css";

type Props = {
  mode: "bases" | "cases";
  caseView: ProcurementDashboardView;
  activeCount: number;
  processingCount: number;
  archiveCount: number;
  searchLoading?: boolean;
  onModeChange: (mode: "bases" | "cases") => void;
  onCaseViewChange: (view: ProcurementDashboardView) => void;
  onSearch: (query: string) => boolean;
};

export function ProcurementModeSwitch({
  mode,
  caseView,
  activeCount,
  processingCount,
  archiveCount,
  searchLoading = false,
  onModeChange,
  onCaseViewChange,
  onSearch
}: Props) {
  const [query, setQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      setSearchMessage("Введите номер заказа.");
      return;
    }
    setSearchMessage(onSearch(query) ? "" : `Заказ «${query.trim()}» не найден.`);
  };

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
        <div className={styles.orchestratorViewToolbar}>
          <div>
            <form className={styles.documentSearch} onSubmit={submitSearch}>
              <Search size={16} />
              <input
                aria-label="Номер заказа"
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (searchMessage) setSearchMessage("");
                }}
                placeholder="Номер заказа"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Очистить поиск"
                  className={styles.documentSearchClear}
                  onClick={() => {
                    setQuery("");
                    setSearchMessage("");
                  }}
                  type="button"
                >
                  <X size={14} />
                </button>
              ) : null}
              <button
                className={styles.documentSearchSubmit}
                disabled={searchLoading}
                type="submit"
              >
                {searchLoading ? <Loader2 className={styles.spin} size={14} /> : "Найти"}
              </button>
            </form>
            {searchMessage ? (
              <div className={styles.orchestratorSearchMessage}>{searchMessage}</div>
            ) : null}
          </div>
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
        </div>
      ) : null}
    </div>
  );
}
