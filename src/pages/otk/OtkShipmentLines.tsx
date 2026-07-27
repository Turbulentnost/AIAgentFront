import { Plus, Trash2 } from "lucide-react";
import type { OtkShipmentLine, OtkTmcCategory } from "./mockData";
import {
  buildSampleRuleForLine,
  formatSampleCompact,
  normalizeTmcCategory
} from "./sampleRule";
import type { OtkShipmentLineUi } from "./otkMappers";
import { lineCheckMark } from "./otkPresentationUi";
import styles from "./OtkWorker.module.css";

/** Select values are English keys; labels are RU. Never swap value↔label. */
const CATEGORY_OPTIONS: { value: OtkTmcCategory; label: string }[] = [
  { value: "electronics", label: "Электроника" },
  { value: "metal", label: "Металл" },
  { value: "fasteners", label: "Крепёж" },
  { value: "cable", label: "Кабель" },
  { value: "pipes", label: "Трубы" },
  { value: "flanges", label: "Фланцы" },
  { value: "gaskets", label: "Прокладки" },
  { value: "drawing_parts", label: "Детали по чертежу" },
  { value: "other", label: "Прочее" }
];

type Props = {
  lines: OtkShipmentLineUi[];
  onChange: (lines: OtkShipmentLineUi[]) => void;
};

function createEmptyLine(): OtkShipmentLineUi {
  return {
    id: `l-${crypto.randomUUID()}`,
    code: "",
    nomenclature: "",
    storageUnit: "шт",
    qtyUpd: 0,
    qtyFact: 1,
    category: "other",
    accepted: false,
    sampleRule: null
  };
}

function parseQty(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function OtkShipmentLines({ lines, onChange }: Props) {
  const updateLine = (id: string, patch: Partial<OtkShipmentLine>) => {
    onChange(
      lines.map((line) => {
        if (line.id !== id) return line;
        const next: OtkShipmentLineUi = { ...line, ...patch };
        if (patch.category !== undefined) {
          next.category = normalizeTmcCategory(patch.category);
        }
        // Keep sampleRule in sync with category/qty so a later server merge
        // cannot flash an old % while category is already updated locally.
        if (
          patch.category !== undefined ||
          patch.qtyFact !== undefined ||
          patch.qtyUpd !== undefined ||
          patch.supplierQualityRating !== undefined
        ) {
          next.sampleRule = buildSampleRuleForLine(next);
        }
        return next;
      })
    );
  };

  const addLine = () => {
    onChange([...lines, createEmptyLine()]);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((line) => line.id !== id));
  };

  return (
    <div className={styles.linesBlock}>
      <div className={styles.linesToolbar}>
        <button type="button" className={styles.secondaryButton} onClick={addLine}>
          <Plus size={14} />
          Добавить позицию
        </button>
      </div>

      {!lines.length ? (
        <div className={styles.emptyState}>В поставке нет элементов.</div>
      ) : (
        <div className={styles.linesScroll}>
          <table className={styles.linesTable}>
            <colgroup>
              <col style={{ width: "11%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "56px" }} />
              <col style={{ width: "40px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Код</th>
                <th>Номенклатура</th>
                <th>Ед. хранения</th>
                <th>Кол-во УПД</th>
                <th>Кол-во факт</th>
                <th>Категория</th>
                <th>Выборка приёмки (СТО)</th>
                <th className={styles.acceptedHead}>Приёмка</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const category = normalizeTmcCategory(line.category);
                // Single source of truth: always derive % from category/qty/rating.
                // Do not prefer cached sampleRule from a stale server merge.
                const sample = buildSampleRuleForLine({ ...line, category });
                const check = lineCheckMark(line.accepted);
                const rowClass =
                  check === "passed" ? styles.lineRowPassed : styles.lineRowNeed;
                const acceptedClass =
                  check === "passed"
                    ? `${styles.acceptedCell} ${styles.acceptedCellPassed}`
                    : `${styles.acceptedCell} ${styles.acceptedCellNeed}`;
                return (
                  <tr key={line.id} className={rowClass}>
                    <td>
                      <input
                        className={styles.lineInput}
                        type="text"
                        value={line.code}
                        placeholder="Код"
                        onChange={(e) => updateLine(line.id, { code: e.target.value })}
                      />
                    </td>
                    <td className={styles.nomenclatureCell}>
                      <textarea
                        className={`${styles.lineInput} ${styles.lineInputNomenclature}`}
                        value={line.nomenclature}
                        placeholder="Номенклатура"
                        rows={2}
                        onChange={(e) =>
                          updateLine(line.id, { nomenclature: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={`${styles.lineInput} ${styles.lineInputUnit}`}
                        type="text"
                        value={line.storageUnit}
                        onChange={(e) =>
                          updateLine(line.id, { storageUnit: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={`${styles.lineInput} ${styles.lineInputQty}`}
                        type="number"
                        min={0}
                        step="any"
                        value={line.qtyUpd}
                        onChange={(e) =>
                          updateLine(line.id, { qtyUpd: parseQty(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={`${styles.lineInput} ${styles.lineInputQty}`}
                        type="number"
                        min={0}
                        step="any"
                        value={line.qtyFact}
                        onChange={(e) =>
                          updateLine(line.id, { qtyFact: parseQty(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className={`${styles.lineInput} ${styles.lineInputCategory}`}
                        value={category}
                        onChange={(e) =>
                          updateLine(line.id, {
                            category: normalizeTmcCategory(e.target.value)
                          })
                        }
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className={styles.sampleCell}>
                        <strong>
                          {formatSampleCompact(sample, line.storageUnit || "шт")}
                        </strong>
                      </div>
                    </td>
                    <td className={acceptedClass}>
                      <label className={styles.acceptedToggle} title="Принято">
                        <input
                          type="checkbox"
                          checked={Boolean(line.accepted)}
                          aria-label="Принято"
                          onChange={(e) =>
                            updateLine(line.id, { accepted: e.target.checked })
                          }
                        />
                        <span className={styles.acceptedLabel}>
                          {line.accepted ? "Да" : "—"}
                        </span>
                      </label>
                    </td>
                    <td className={styles.lineActionsCell}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        title="Удалить"
                        aria-label="Удалить позицию"
                        onClick={() => removeLine(line.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
