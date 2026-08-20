import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Download, Loader2, Search, X } from "lucide-react";
import { agentsApi } from "@/api/endpoints";
import {
  exportMaterialLinesToExcel,
  type MaterialCalculatorLine,
} from "@/utils/materialCalculatorExcelExport";
import styles from "./MaterialCalculatorModal.module.css";

type SpecRow = {
  ref_key: string;
  code: string;
  description: string;
  main_product_name: string;
  materials_count: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

function specTitle(row: SpecRow): string {
  const parts = [row.code, row.description].filter(Boolean);
  return parts.join(" · ") || row.ref_key;
}

export default function MaterialCalculatorModal({ open, onClose }: Props) {
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [specsLoaded, setSpecsLoaded] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resultLines, setResultLines] = useState<MaterialCalculatorLine[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setSpecs([]);
    setSearch("");
    setQuantities({});
    setLoadError(null);
    setCalcError(null);
    setWarnings([]);
    setResultLines([]);
    setResultOpen(false);
    setExportError(null);
    setSpecsLoaded(false);
    setLoadingSpecs(false);
    setCalculating(false);
    setExporting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const loadSpecs = useCallback(async () => {
    setLoadingSpecs(true);
    setLoadError(null);
    try {
      const response = await agentsApi.listAveonResourceSpecs({ limit: 1000 });
      const items = (response.items ?? []).filter((item) => item.materials_count > 0);
      items.sort((a, b) => specTitle(a).localeCompare(specTitle(b), "ru"));
      setSpecs(items);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Не удалось загрузить спецификации");
      setSpecs([]);
    } finally {
      setLoadingSpecs(false);
      setSpecsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!open || specsLoaded || loadingSpecs) return;
    void loadSpecs();
  }, [open, specsLoaded, loadingSpecs, loadSpecs]);

  const filteredSpecs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return specs;
    return specs.filter((row) => {
      const haystack = [row.code, row.description, row.main_product_name, row.ref_key]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, specs]);

  const selectedCount = useMemo(
    () =>
      Object.values(quantities).filter((value) => {
        const parsed = Number(value.replace(",", "."));
        return Number.isFinite(parsed) && parsed > 0;
      }).length,
    [quantities]
  );

  async function handleCalculate() {
    setCalcError(null);
    setWarnings([]);

    const items = specs
      .map((row) => {
        const raw = (quantities[row.ref_key] ?? "").trim().replace(",", ".");
        const quantity = Number(raw);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        return { spec_ref_key: row.ref_key, quantity };
      })
      .filter((item): item is { spec_ref_key: string; quantity: number } => item !== null);

    if (items.length === 0) {
      setCalcError("Укажите количество хотя бы для одной спецификации");
      return;
    }

    setCalculating(true);
    try {
      const response = await agentsApi.calculateAveonMaterials(items);
      setResultLines(response.lines ?? []);
      setWarnings(response.warnings ?? []);
      setResultOpen(true);
    } catch (error) {
      setCalcError(error instanceof Error ? error.message : "Не удалось выполнить расчёт");
    } finally {
      setCalculating(false);
    }
  }

  async function handleExportExcel() {
    if (resultLines.length === 0) return;
    setExportError(null);
    setExporting(true);
    try {
      await exportMaterialLinesToExcel(agentsApi.exportAveonMaterialsExcel, resultLines);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Не удалось выгрузить Excel");
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  if (resultOpen) {
    return (
      <div
        className={styles.overlay}
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="calc-result-title">
          <div className={styles.header}>
            <div>
              <h2 id="calc-result-title" className={styles.title}>
                Потребность в материалах
              </h2>
              <p className={styles.meta}>
                {resultLines.length} позиций · выбрано спецификаций: {selectedCount}
              </p>
            </div>
            <button type="button" className={styles.closeBtn} aria-label="Закрыть" onClick={onClose}>
              <X size={28} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className={styles.body}>
            {warnings.length > 0 ? (
              <ul className={styles.warningList}>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            {resultLines.length === 0 ? (
              <div className={styles.stateBox}>Нет материалов для расчёта</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Номенклатура</th>
                      <th>Количество</th>
                      <th>Ед. изм.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultLines.map((line) => (
                      <tr key={line.nomenclature_key}>
                        <td>{line.code || "—"}</td>
                        <td>{line.name}</td>
                        <td className={styles.numCell}>{formatQty(line.total_qty)}</td>
                        <td>{line.unit || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={styles.footer}>
            {exportError ? <p className={styles.error}>{exportError}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setResultOpen(false)}>
                К спецификациям
              </button>
              <button type="button" className={styles.secondaryButton} onClick={onClose}>
                Закрыть
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={exporting || resultLines.length === 0}
                onClick={() => void handleExportExcel()}
              >
                {exporting ? (
                  <>
                    <Loader2 size={18} className={styles.spinner} aria-hidden />
                    Выгружаем…
                  </>
                ) : (
                  <>
                    <Download size={18} aria-hidden />
                    Выгрузить в Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="material-calculator-title">
        <div className={styles.header}>
          <div>
            <h2 id="material-calculator-title" className={styles.title}>
              Калькулятор материалов
            </h2>
            <p className={styles.meta}>
              Укажите количество изделий по спецификациям — система посчитает потребность в материалах
            </p>
          </div>
          <button type="button" className={styles.closeBtn} aria-label="Закрыть" onClick={onClose}>
            <X size={28} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={16} aria-hidden className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Поиск спецификации или изделия…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {loadError ? <p className={styles.error}>{loadError}</p> : null}
        {calcError ? <p className={styles.error}>{calcError}</p> : null}

        <div className={styles.body}>
          {loadingSpecs ? (
            <div className={styles.stateBox}>
              <Loader2 size={22} className={styles.spinner} aria-hidden />
              <span>Загружаю спецификации…</span>
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Спецификация</th>
                      <th>Изделие</th>
                      <th>Кол-во изделий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSpecs.map((row) => (
                      <tr key={row.ref_key}>
                        <td>
                          <div className={styles.specName}>{specTitle(row)}</div>
                          <div className={styles.specMeta}>{row.materials_count} материалов</div>
                        </td>
                        <td>{row.main_product_name || "—"}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            className={styles.qtyInput}
                            placeholder="0"
                            value={quantities[row.ref_key] ?? ""}
                            onChange={(event) =>
                              setQuantities((prev) => ({
                                ...prev,
                                [row.ref_key]: event.target.value,
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredSpecs.length === 0 ? (
                <div className={styles.stateBox}>
                  <span>Спецификации не найдены</span>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setSpecsLoaded(false);
                    }}
                  >
                    Обновить
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Закрыть
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={calculating || selectedCount === 0}
              onClick={() => void handleCalculate()}
            >
              {calculating ? (
                <>
                  <Loader2 size={18} className={styles.spinner} aria-hidden />
                  Считаем…
                </>
              ) : (
                <>
                  <Calculator size={18} aria-hidden />
                  Рассчитать
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
