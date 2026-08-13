import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { StockBalancesCache } from "./useAveonReferenceCache";
import styles from "./TempStockBalancesModal.module.css";

type Props = {
  open: boolean;
  loading: boolean;
  data: StockBalancesCache | null;
  onClose: () => void;
};

type StockRow = StockBalancesCache["items"][number];

type WarehouseBreakdown = {
  warehouse: string;
  in_stock: number;
  to_ship: number;
  available: number;
};

type AggregatedStockRow = {
  key: string;
  code: string;
  name: string;
  warehouses: WarehouseBreakdown[];
  in_stock: number;
  to_ship: number;
  available: number;
};

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

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

function nomenclatureKey(row: StockRow): string {
  const key = (row.nomenclature_key ?? "").trim();
  if (key && key !== EMPTY_GUID) return `k:${key}`;
  const code = (row.code ?? "").trim();
  if (code) return `c:${code.toLowerCase()}`;
  return `n:${(row.name ?? "").trim().toLowerCase()}`;
}

function warehouseCountLabel(count: number): string {
  if (count === 1) return "1 склад";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `в ${count} складах`;
  }
  return `в ${count} складах`;
}

function aggregateStockRows(rows: StockRow[]): AggregatedStockRow[] {
  const map = new Map<string, AggregatedStockRow>();

  for (const row of rows) {
    const key = nomenclatureKey(row);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        code: row.code,
        name: row.name,
        warehouses: [],
        in_stock: 0,
        to_ship: 0,
        available: 0,
      };
      map.set(key, entry);
    }

    entry.in_stock += row.in_stock;
    entry.to_ship += row.to_ship;
    entry.available += row.available;
    entry.warehouses.push({
      warehouse: row.warehouse,
      in_stock: row.in_stock,
      to_ship: row.to_ship,
      available: row.available,
    });
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      warehouses: entry.warehouses.sort((a, b) => a.warehouse.localeCompare(b.warehouse, "ru")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export default function TempStockBalancesModal({ open, loading, data, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const items = data?.items ?? [];

  const warehouses = useMemo(() => {
    const set = new Set(items.map((row) => row.warehouse).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [items]);

  const filteredItems = useMemo(() => {
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

  const grouped = useMemo(() => aggregateStockRows(filteredItems), [filteredItems]);
  const expandedRow = expandedKey ? grouped.find((row) => row.key === expandedKey) ?? null : null;

  function closePopover() {
    setExpandedKey(null);
    setPopoverPos(null);
  }

  useEffect(() => {
    if (!expandedKey) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (target instanceof Element && target.closest("[data-stock-details-btn]")) return;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        closePopover();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePopover();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedKey]);

  useEffect(() => {
    if (!open) closePopover();
  }, [open]);

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
                : data?.specMaterialsOnly
                  ? `${grouped.length.toLocaleString("ru-RU")} номенклатур из спецификаций · синхр. ${formatDate(data?.syncedAt)}`
                  : `${grouped.length.toLocaleString("ru-RU")} номенклатур · синхр. ${formatDate(data?.syncedAt)}`}
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
              onChange={(event) => {
                setWarehouseFilter(event.target.value);
                closePopover();
              }}
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
          ) : grouped.length === 0 ? (
            <p className={styles.state}>Остатки не найдены.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Номенклатура</th>
                    <th>Склады</th>
                    <th className={styles.numCol}>В наличии</th>
                    <th className={styles.numCol}>К отгрузке</th>
                    <th className={styles.numCol}>Доступно</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((row) => (
                    <tr key={row.key}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td className={styles.warehouseCell}>
                        {row.warehouses.length === 1 ? (
                          <span className={styles.warehouseSingle} title={row.warehouses[0].warehouse}>
                            {row.warehouses[0].warehouse}
                          </span>
                        ) : (
                          <div className={styles.warehouseMulti}>
                            <span className={styles.warehouseBadge}>
                              {warehouseCountLabel(row.warehouses.length)}
                            </span>
                            <button
                              type="button"
                              className={styles.detailsBtn}
                              data-stock-details-btn
                              aria-expanded={expandedKey === row.key}
                              onClick={(event) => {
                                if (expandedKey === row.key) {
                                  closePopover();
                                  return;
                                }
                                const rect = event.currentTarget.getBoundingClientRect();
                                setExpandedKey(row.key);
                                setPopoverPos({
                                  top: rect.bottom + 6,
                                  left: rect.left,
                                });
                              }}
                            >
                              подробнее
                            </button>
                          </div>
                        )}
                      </td>
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

        {expandedRow && popoverPos ? (
          <div
            ref={popoverRef}
            className={styles.popover}
            role="dialog"
            aria-label="Остатки по складам"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            <p className={styles.popoverTitle}>{expandedRow.name}</p>
            <table className={styles.popoverTable}>
              <thead>
                <tr>
                  <th>Склад</th>
                  <th className={styles.numCol}>В наличии</th>
                  <th className={styles.numCol}>К отгрузке</th>
                  <th className={styles.numCol}>Доступно</th>
                </tr>
              </thead>
              <tbody>
                {expandedRow.warehouses.map((warehouseRow) => (
                  <tr key={warehouseRow.warehouse}>
                    <td>{warehouseRow.warehouse}</td>
                    <td className={styles.numCol}>{formatQty(warehouseRow.in_stock)}</td>
                    <td className={styles.numCol}>{formatQty(warehouseRow.to_ship)}</td>
                    <td className={styles.numCol}>{formatQty(warehouseRow.available)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
