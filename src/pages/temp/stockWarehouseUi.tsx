import { useEffect, useRef } from "react";
import styles from "./TempStockBalancesModal.module.css";

export type WarehouseBreakdown = {
  warehouse: string;
  in_stock: number;
  to_ship: number;
  available: number;
};

export type StockWarehouseRow = {
  name: string;
  warehouse: string;
  in_stock: number;
  to_ship: number;
  available: number;
};

export function normalizeStockNomenclatureName(name: string): string {
  return name.trim().toLowerCase();
}

export function warehouseCountLabel(count: number): string {
  if (count === 1) return "1 склад";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `в ${count} складах`;
  }
  return `в ${count} складах`;
}

export function buildStockWarehousesByName(items: StockWarehouseRow[]): Map<string, WarehouseBreakdown[]> {
  const map = new Map<string, WarehouseBreakdown[]>();

  for (const item of items) {
    const key = normalizeStockNomenclatureName(item.name);
    if (!key) continue;
    const list = map.get(key) ?? [];
    const existing = list.find((row) => row.warehouse === item.warehouse);
    if (existing) {
      existing.in_stock += item.in_stock;
      existing.to_ship += item.to_ship;
      existing.available += item.available;
    } else {
      list.push({
        warehouse: item.warehouse,
        in_stock: item.in_stock,
        to_ship: item.to_ship,
        available: item.available,
      });
    }
    map.set(key, list);
  }

  for (const [key, list] of map) {
    map.set(
      key,
      [...list].sort((left, right) => left.warehouse.localeCompare(right.warehouse, "ru"))
    );
  }

  return map;
}

export function warehouseExportLabel(warehouses: WarehouseBreakdown[]): string {
  if (!warehouses.length) return "—";
  if (warehouses.length === 1) return warehouses[0].warehouse;
  return warehouses
    .map((row) => `${row.warehouse} (${formatWarehouseQty(row.available)} д.)`)
    .join("; ");
}

function formatWarehouseQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toLocaleString("ru-RU");
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

type StockWarehouseCellProps = {
  warehouses: WarehouseBreakdown[];
  rowKey: string;
  isExpanded: boolean;
  onToggle: (rowKey: string, anchor: DOMRect) => void;
};

export function StockWarehouseCell({
  warehouses,
  rowKey,
  isExpanded,
  onToggle,
}: StockWarehouseCellProps) {
  if (warehouses.length === 0) {
    return <span className={styles.warehouseBadge}>—</span>;
  }

  if (warehouses.length === 1) {
    return (
      <span className={styles.warehouseSingle} title={warehouses[0].warehouse}>
        {warehouses[0].warehouse}
      </span>
    );
  }

  return (
    <div className={styles.warehouseMulti}>
      <span className={styles.warehouseBadge}>{warehouseCountLabel(warehouses.length)}</span>
      <button
        type="button"
        className={styles.detailsBtn}
        data-stock-details-btn
        aria-expanded={isExpanded}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(rowKey, event.currentTarget.getBoundingClientRect());
        }}
      >
        подробнее
      </button>
    </div>
  );
}

type StockWarehousePopoverProps = {
  nomenclatureName: string;
  warehouses: WarehouseBreakdown[];
  position: { top: number; left: number } | null;
  onClose: () => void;
};

export function StockWarehousePopover({
  nomenclatureName,
  warehouses,
  position,
  onClose,
}: StockWarehousePopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!position) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (target instanceof Element && target.closest("[data-stock-details-btn]")) return;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, position]);

  if (!position || warehouses.length === 0) return null;

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label="Остатки по складам"
      style={{ top: position.top, left: position.left }}
    >
      <p className={styles.popoverTitle}>{nomenclatureName}</p>
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
          {warehouses.map((warehouseRow) => (
            <tr key={warehouseRow.warehouse}>
              <td>{warehouseRow.warehouse}</td>
              <td className={styles.numCol}>{formatWarehouseQty(warehouseRow.in_stock)}</td>
              <td className={styles.numCol}>{formatWarehouseQty(warehouseRow.to_ship)}</td>
              <td className={styles.numCol}>{formatWarehouseQty(warehouseRow.available)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
