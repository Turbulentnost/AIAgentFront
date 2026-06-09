import { ChevronRightIcon } from "@primer/octicons-react";
import { useEffect, useMemo, useState } from "react";
import { FormCheckbox } from "@/components/form-controls";
import type { Department } from "@/types";
import {
  buildDepartmentTree,
  filterDepartmentTree,
  getDefaultExpandedDepartmentIds,
  type DepartmentTreeNode
} from "@/utils/departmentTree";
import styles from "./DepartmentCheckboxTree.module.css";

function TreeNodeRow({
  node,
  depth,
  expandedIds,
  checkedIds,
  selectedIds,
  onToggleExpand,
  onToggleChecked
}: {
  node: DepartmentTreeNode;
  depth: number;
  expandedIds: Set<string>;
  checkedIds: Set<string>;
  selectedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleChecked: (id: string) => void;
}) {
  const isOpen = expandedIds.has(node.department.id);
  const hasChildren = node.children.length > 0;
  const isChecked = checkedIds.has(node.department.id) || selectedIds.has(node.department.id);

  return (
    <li className={styles.folderBlock}>
      <div className={styles.row} style={{ paddingLeft: `${8 + depth * 16}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.chevronWrap}
            aria-label={isOpen ? "Свернуть" : "Развернуть"}
            aria-expanded={isOpen}
            onClick={() => onToggleExpand(node.department.id)}
          >
            <ChevronRightIcon className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} size={12} />
          </button>
        ) : (
          <span className={styles.chevronSpacer} aria-hidden="true" />
        )}
        <FormCheckbox
          checked={isChecked}
          aria-label={node.department.name}
          onChange={() => onToggleChecked(node.department.id)}
        />
        <span className={styles.nodeName} title={node.department.name}>
          {node.department.name}
        </span>
      </div>
      {hasChildren && isOpen ? (
        <ul className={styles.children}>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.department.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              checkedIds={checkedIds}
              selectedIds={selectedIds}
              onToggleExpand={onToggleExpand}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function DepartmentCheckboxTree({
  departments,
  checkedIds,
  selectedIds,
  search = "",
  onToggleChecked
}: {
  departments: Department[];
  checkedIds: string[];
  selectedIds: string[];
  search?: string;
  onToggleChecked: (id: string) => void;
}) {
  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const filteredTree = useMemo(() => filterDepartmentTree(tree, search), [search, tree]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(getDefaultExpandedDepartmentIds(tree)));

  useEffect(() => {
    if (search.trim()) {
      setExpandedIds(new Set(getDefaultExpandedDepartmentIds(filteredTree, 99)));
      return;
    }
    setExpandedIds(new Set(getDefaultExpandedDepartmentIds(tree)));
  }, [filteredTree, search, tree]);

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleExpand(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!filteredTree.length) {
    return <p className={styles.empty}>Подразделения не найдены</p>;
  }

  return (
    <div className={styles.tree}>
      <ul className={styles.rootList}>
        {filteredTree.map((node) => (
          <TreeNodeRow
            key={node.department.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            checkedIds={checkedSet}
            selectedIds={selectedSet}
            onToggleExpand={toggleExpand}
            onToggleChecked={onToggleChecked}
          />
        ))}
      </ul>
    </div>
  );
}
