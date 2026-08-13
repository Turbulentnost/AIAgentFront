import { useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { StockBalancesCache } from "./useAveonReferenceCache";
import styles from "./TempStockBalancesModal.module.css";

type Props = {
  open: boolean;
  loading: boolean;
  data: StockBalancesCache | null;
  onClose: () => void;
};

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toLocaleString("ru-RU");
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TempStockBalancesModal({ open, loading, data, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");

  const items = data?.items ?? [];

  const warehouses = useMemo(() => {
    const set = new Set(items.map((row) => row.warehouse).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((row) => {
      if (warehouseFilter && row.warehouse !== warehouseFilter) return false;
      if (!query) return true;
      return (
        row.code.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query) ||
        row.warehouse.toLowerCase().includes(query)
      );
    });
  }, [items, search, warehouseFilter]);

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
        aria-labelledby="temp-stock-balances-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="temp-stock-balances-title" className={styles.title}>
              Остатки на складах
            </h2>
            <p className={styles.meta}>
              {loading
                ? "загрузка…"
                : `${data?.total?.toLocaleString("ru-RU") ?? 0} позиций · синхр. ${formatDate(data?.syncedAt)}`}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Поиск</span>
            <div className={styles.searchWrap}>
              <Search size={16} aria-hidden className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="По коду, названию, складу…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Склад</span>
            <select
              className={styles.select}
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
            >
              <option value="">Все склады</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse} value={warehouse}>
                  {warehouse}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.state}>
              <Loader2 className={styles.spinner} size={22} aria-hidden />
              <span>Загружаю остатки из БД…</span>
            </div>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filtered.length === 0 ? (
            <p className={styles.state}>Остатки не найдены.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Номенклатура</th>
                    <th>Склад</th>
                    <th className={styles.numCol}>В наличии</th>
                    <th className={styles.numCol}>К отгрузке</th>
                    <th className={styles.numCol}>Доступно</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, index) => (
                    <tr key={`${row.nomenclature_key ?? row.code}-${row.warehouse}-${index}`}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.warehouse}</td>
                      <td className={styles.numCol}>{formatQty(row.in_stock)}</td>
                      <td className={styles.numCol}>{formatQty(row.to_ship)}</td>
                      <td className={styles.numCol}>{formatQty(row.available)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
