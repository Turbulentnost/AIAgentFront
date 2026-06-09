import { ArrowLeft, ArrowRight, Info, Search, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import DepartmentCheckboxTree from "@/components/DepartmentCheckboxTree";
import type { Department } from "@/types";
import { buildDepartmentTree, countDepartmentTreeNodes } from "@/utils/departmentTree";
import styles from "./DepartmentTransferList.module.css";

export default function DepartmentTransferList({
  departments,
  selectedIds,
  onChange
}: {
  departments: Department[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const availableCount = useMemo(() => countDepartmentTreeNodes(tree), [tree]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedDepartments = useMemo(
    () => selectedIds.map((id) => departments.find((department) => department.id === id)).filter(Boolean) as Department[],
    [departments, selectedIds]
  );

  function toggleRowChecked(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      setCheckedIds((current) => current.filter((item) => item !== id));
      return;
    }
    setCheckedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function moveToSelected() {
    onChange([...new Set([...selectedIds, ...checkedIds])]);
    setCheckedIds([]);
  }

  function moveFromSelected() {
    onChange(selectedIds.filter((id) => !checkedIds.includes(id)));
    setCheckedIds([]);
  }

  function removeOne(id: string) {
    onChange(selectedIds.filter((item) => item !== id));
    setCheckedIds((current) => current.filter((item) => item !== id));
  }

  return (
    <section className={styles.root} aria-label="Выбор подразделений">
      <div className={styles.sectionHead}>
        <span className={styles.panelTitle}>Доступ для подразделений</span>
        <button type="button" className={styles.infoButton} aria-label="Подсказка о доступе для подразделений">
          <Info size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.searchField}>
        <Search className={styles.searchIcon} size={16} strokeWidth={2} aria-hidden="true" />
        <input
          className={styles.searchInput}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск подразделения"
        />
      </div>

      <div className={styles.transferShell}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Доступные подразделения</span>
            <span className={styles.panelCount}>{availableCount}</span>
          </div>
          <div className={styles.panelBody}>
            <DepartmentCheckboxTree
              departments={departments}
              checkedIds={checkedIds}
              selectedIds={selectedIds}
              search={search}
              onToggleChecked={toggleRowChecked}
            />
          </div>
        </div>

        <div className={styles.transferActions}>
          <button
            type="button"
            className={styles.transferButton}
            aria-label="Добавить выбранные подразделения"
            disabled={!checkedIds.length}
            onClick={moveToSelected}
          >
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.transferButton}
            aria-label="Убрать выбранные подразделения"
            disabled={!checkedIds.some((id) => selectedSet.has(id))}
            onClick={moveFromSelected}
          >
            <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Выбрано ({selectedDepartments.length})</span>
            <button type="button" className={styles.clearButton} disabled={!selectedDepartments.length} onClick={() => onChange([])}>
              Очистить все
            </button>
          </div>
          <div className={styles.panelBody}>
            {selectedDepartments.length ? (
              <ul className={styles.selectedList}>
                {selectedDepartments.map((department) => (
                  <li key={department.id} className={styles.selectedRow}>
                    <UserRound className={styles.selectedIcon} size={16} strokeWidth={2} aria-hidden="true" />
                    <span className={styles.nodeName}>{department.name}</span>
                    <button type="button" className={styles.removeButton} aria-label={`Убрать ${department.name}`} onClick={() => removeOne(department.id)}>
                      <X size={14} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>Подразделения не выбраны</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
