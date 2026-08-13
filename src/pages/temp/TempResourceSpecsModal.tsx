import { useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { ResourceSpecDetail, ResourceSpecsCache } from "./useAveonReferenceCache";
import styles from "./TempResourceSpecsModal.module.css";

type Props = {
  open: boolean;
  loading: boolean;
  data: ResourceSpecsCache | null;
  onClose: () => void;
};

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

function specLabel(item: { code: string; description: string; main_product_name?: string }): string {
  const parts = [item.code, item.description].filter(Boolean);
  if (item.main_product_name) parts.push(`→ ${item.main_product_name}`);
  return parts.join(" · ");
}

export default function TempResourceSpecsModal({ open, loading, data, onClose }: Props) {
  const [selectedRefKey, setSelectedRefKey] = useState("");
  const [search, setSearch] = useState("");

  const items = data?.items ?? [];
  const defaultRefKey = items[0]?.ref_key ?? "";
  const activeRefKey = selectedRefKey || defaultRefKey;

  const activeSpec: ResourceSpecDetail | null = useMemo(() => {
    if (!data || !activeRefKey) return null;
    return data.details[activeRefKey] ?? null;
  }, [data, activeRefKey]);

  const filteredMaterials = useMemo(() => {
    if (!activeSpec) return [];
    const query = search.trim().toLowerCase();
    if (!query) return activeSpec.materials;
    return activeSpec.materials.filter(
      (row) =>
        row.code.toLowerCase().includes(query) || row.name.toLowerCase().includes(query)
    );
  }, [activeSpec, search]);

  if (!open) return null;

  const error = data && !data.ok ? data.error : null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="temp-resource-specs-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="temp-resource-specs-title" className={styles.title}>
              Спецификации
            </h2>
            <p className={styles.meta}>
              {loading
                ? "загрузка…"
                : `${items.length} спецификаций · материалы из БД 1С`}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Спецификация</span>
            <select
              className={styles.select}
              value={activeRefKey}
              disabled={loading || items.length === 0}
              onChange={(event) => setSelectedRefKey(event.target.value)}
            >
              {items.map((item) => (
                <option key={item.ref_key} value={item.ref_key}>
                  {specLabel(item)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Поиск</span>
            <div className={styles.searchWrap}>
              <Search size={16} aria-hidden className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="По коду или названию…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={!activeSpec}
              />
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.state}>
              <Loader2 className={styles.spinner} size={22} aria-hidden />
              <span>Загружаю спецификации из БД…</span>
            </div>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : !activeSpec ? (
            <p className={styles.state}>Спецификации не найдены в БД.</p>
          ) : (
            <>
              <div className={styles.specMeta}>
                <span>{activeSpec.description || activeSpec.code}</span>
                {activeSpec.main_product?.name ? (
                  <span>Изделие: {activeSpec.main_product.name}</span>
                ) : null}
                <span>Статус: {activeSpec.status || "—"}</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Код</th>
                      <th>Номенклатура</th>
                      <th className={styles.numCol}>Кол-во</th>
                      <th>Ед.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.emptyRow}>
                          {search ? "Ничего не найдено" : "Материалы отсутствуют"}
                        </td>
                      </tr>
                    ) : (
                      filteredMaterials.map((row) => (
                        <tr key={`${row.line_number}-${row.code}`}>
                          <td>{row.line_number}</td>
                          <td>{row.code}</td>
                          <td>{row.name}</td>
                          <td className={styles.numCol}>{formatQty(row.qty)}</td>
                          <td>{row.unit || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
