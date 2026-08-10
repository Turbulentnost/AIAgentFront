import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownAZ, ArrowUpAZ, Filter, X } from "lucide-react";
import { FormCheckbox } from "@/components/form-controls";
import type { ShipmentColumnLayout } from "./mergedShipmentColumns";
import styles from "./TempMergedShipmentViewer.module.css";

export type ShipmentRowSort = "default" | "name-asc" | "name-desc" | "qty-desc";

type Props = {
  layout: ShipmentColumnLayout;
  visibleMeta: Set<number>;
  dateFrom: string | null;
  dateTo: string | null;
  rowSort: ShipmentRowSort;
  active: boolean;
  onVisibleMetaChange: (next: Set<number>) => void;
  onDateFromChange: (value: string | null) => void;
  onDateToChange: (value: string | null) => void;
  onRowSortChange: (value: ShipmentRowSort) => void;
  onReset: () => void;
};

function formatRuDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

export default function ShipmentColumnFilterMenu({
  layout,
  visibleMeta,
  dateFrom,
  dateTo,
  rowSort,
  active,
  onVisibleMetaChange,
  onDateFromChange,
  onDateToChange,
  onRowSortChange,
  onReset,
}: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const [portalRoot, setPortalRoot] = useState<HTMLElement>(() => document.body);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const root =
      (anchor.closest("[data-column-menu-portal]") as HTMLElement | null) ?? document.body;
    setPortalRoot(root);
  }, []);

  const metaOptions = useMemo(
    () =>
      layout.metaIndices
        .filter((index) => index !== 0)
        .map((index) => {
          const labelIndex = layout.metaIndices.indexOf(index);
          return {
            index,
            label: layout.metaLabels[labelIndex] ?? `Колонка ${index + 1}`,
          };
        }),
    [layout]
  );

  const dateBounds = useMemo(() => {
    if (!layout.dateColumns.length) return { min: "", max: "" };
    return {
      min: layout.dateColumns[0].iso,
      max: layout.dateColumns[layout.dateColumns.length - 1].iso,
    };
  }, [layout.dateColumns]);

  const visibleDateCount = useMemo(() => {
    return layout.dateColumns.filter((column) => {
      if (dateFrom && column.iso < dateFrom) return false;
      if (dateTo && column.iso > dateTo) return false;
      return true;
    }).length;
  }, [layout.dateColumns, dateFrom, dateTo]);

  const updatePlacement = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = 320;
    let left = rect.left;
    let top: number;
    const menuHeight = menu?.offsetHeight ?? 420;
    const gap = 8;

    if (portalRoot === document.body) {
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - width - 12);
      }
      top = rect.bottom + gap;
      if (top + menuHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - menuHeight - gap);
      }
    } else {
      const rootRect = portalRoot.getBoundingClientRect();
      left = rect.left - rootRect.left;
      top = rect.bottom - rootRect.top + gap;
      const availableWidth = portalRoot.clientWidth;
      if (left + width > availableWidth - 12) {
        left = Math.max(12, availableWidth - width - 12);
      }
      if (top + menuHeight > portalRoot.clientHeight - 12) {
        top = Math.max(12, rect.top - rootRect.top - menuHeight - gap);
      }
    }

    setPlacement({ top, left, width });
  }, [portalRoot]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePlacement();
    const raf = requestAnimationFrame(updatePlacement);
    return () => cancelAnimationFrame(raf);
  }, [open, updatePlacement, metaOptions.length, layout.dateColumns.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, updatePlacement]);

  const toggleMeta = (index: number) => {
    const next = new Set(visibleMeta);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    onVisibleMetaChange(next);
  };

  const selectAllMeta = () => {
    onVisibleMetaChange(new Set(layout.metaIndices));
  };

  const clearMetaExceptNomenclature = () => {
    onVisibleMetaChange(new Set([0]));
  };

  return (
    <div className={styles.filterWrap} ref={anchorRef}>
      <button
        type="button"
        className={`${styles.filterBtn} ${open ? styles.filterBtnOpen : ""} ${
          active ? styles.filterBtnActive : ""
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Фильтр колонок и дат"
        onClick={() => setOpen((current) => !current)}
      >
        <Filter size={16} strokeWidth={2.2} aria-hidden />
        {active ? <span className={styles.filterBtnDot} aria-hidden /> : null}
      </button>

      {open && placement
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.filterMenu}
              style={{
                top: placement.top,
                left: placement.left,
                width: placement.width,
                position: portalRoot === document.body ? "fixed" : "absolute",
              }}
              role="dialog"
              aria-label="Фильтр графика отгрузок"
            >
              <div className={styles.filterMenuHeader}>
                <strong className={styles.filterMenuTitle}>Колонки и даты</strong>
                <button
                  type="button"
                  className={styles.filterMenuClose}
                  aria-label="Закрыть"
                  onClick={() => setOpen(false)}
                >
                  <X size={16} aria-hidden />
                </button>
              </div>

              <div className={styles.filterMenuBody}>
              <div className={styles.filterMenuSection}>
                <div className={styles.filterMenuSectionHead}>
                  <p className={styles.filterMenuSectionTitle}>Колонки до дат</p>
                  <div className={styles.filterMenuQuickActions}>
                    <button type="button" className={styles.filterMenuLink} onClick={selectAllMeta}>
                      Все
                    </button>
                    <button
                      type="button"
                      className={styles.filterMenuLink}
                      onClick={clearMetaExceptNomenclature}
                    >
                      Только номенклатура
                    </button>
                  </div>
                </div>
                <div className={styles.filterMenuOptions}>
                  <div className={styles.filterMenuOption}>
                    <FormCheckbox
                      className={styles.filterMenuCheckbox}
                      checked
                      disabled
                      onChange={() => undefined}
                      label="Номенклатура"
                    />
                  </div>
                  {metaOptions.map((option) => (
                    <div key={option.index} className={styles.filterMenuOption}>
                      <FormCheckbox
                        className={styles.filterMenuCheckbox}
                        checked={visibleMeta.has(option.index)}
                        onChange={() => toggleMeta(option.index)}
                        label={option.label}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {layout.dateColumns.length > 0 ? (
                <div className={styles.filterMenuSection}>
                  <div className={styles.filterMenuSectionHead}>
                    <p className={styles.filterMenuSectionTitle}>Даты отгрузки</p>
                    <span className={styles.filterMenuHint}>{visibleDateCount} кол.</span>
                  </div>
                  <div className={styles.filterDateRange}>
                    <label className={styles.filterDateField}>
                      <span className={styles.filterDateLabel}>Дата начала</span>
                      <input
                        type="date"
                        className={styles.filterDateInput}
                        value={dateFrom ?? ""}
                        min={dateBounds.min}
                        max={dateTo ?? dateBounds.max}
                        onChange={(event) =>
                          onDateFromChange(event.target.value ? event.target.value : null)
                        }
                      />
                    </label>
                    <label className={styles.filterDateField}>
                      <span className={styles.filterDateLabel}>Дата окончания</span>
                      <input
                        type="date"
                        className={styles.filterDateInput}
                        value={dateTo ?? ""}
                        min={dateFrom ?? dateBounds.min}
                        max={dateBounds.max}
                        onChange={(event) =>
                          onDateToChange(event.target.value ? event.target.value : null)
                        }
                      />
                    </label>
                  </div>
                  {dateBounds.min && dateBounds.max ? (
                    <p className={styles.filterDateMeta}>
                      Доступно {formatRuDate(dateBounds.min)} — {formatRuDate(dateBounds.max)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.filterMenuSection}>
                <p className={styles.filterMenuSectionTitle}>Сортировка строк</p>
                <div className={styles.filterSortActions}>
                  <button
                    type="button"
                    className={`${styles.filterSortBtn} ${
                      rowSort === "name-asc" ? styles.filterSortBtnActive : ""
                    }`}
                    onClick={() =>
                      onRowSortChange(rowSort === "name-asc" ? "default" : "name-asc")
                    }
                  >
                    <ArrowUpAZ size={15} aria-hidden />
                    Номенклатура А→Я
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterSortBtn} ${
                      rowSort === "name-desc" ? styles.filterSortBtnActive : ""
                    }`}
                    onClick={() =>
                      onRowSortChange(rowSort === "name-desc" ? "default" : "name-desc")
                    }
                  >
                    <ArrowDownAZ size={15} aria-hidden />
                    Номенклатура Я→А
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterSortBtn} ${
                      rowSort === "qty-desc" ? styles.filterSortBtnActive : ""
                    }`}
                    onClick={() =>
                      onRowSortChange(rowSort === "qty-desc" ? "default" : "qty-desc")
                    }
                  >
                    По сумме отгрузок
                  </button>
                </div>
              </div>
              </div>

              <div className={styles.filterMenuFooter}>
                <button type="button" className={styles.filterResetBtn} onClick={onReset}>
                  Сбросить всё
                </button>
              </div>
            </div>,
            portalRoot
          )
        : null}
    </div>
  );
}
