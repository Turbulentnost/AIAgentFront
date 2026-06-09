import type { Department } from "@/types";

export interface DepartmentTreeNode {
  department: Department;
  children: DepartmentTreeNode[];
}

export function buildDepartmentTree(departments: Department[]): DepartmentTreeNode[] {
  const byParent = new Map<string | null, Department[]>();

  for (const department of departments) {
    const parentKey = department.parent_id ?? null;
    const bucket = byParent.get(parentKey);
    if (bucket) bucket.push(department);
    else byParent.set(parentKey, [department]);
  }

  for (const bucket of byParent.values()) {
    bucket.sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }

  function walk(parentId: string | null): DepartmentTreeNode[] {
    return (byParent.get(parentId) ?? []).map((department) => ({
      department,
      children: walk(department.id)
    }));
  }

  return walk(null);
}

export function countDepartmentTreeNodes(nodes: DepartmentTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countDepartmentTreeNodes(node.children), 0);
}

export function filterDepartmentTree(nodes: DepartmentTreeNode[], query: string): DepartmentTreeNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;

  function walk(node: DepartmentTreeNode): DepartmentTreeNode | null {
    const selfMatches = node.department.name.toLowerCase().includes(normalized);
    const children = node.children.map(walk).filter((item): item is DepartmentTreeNode => item !== null);
    if (selfMatches || children.length) {
      return { department: node.department, children: selfMatches ? node.children : children };
    }
    return null;
  }

  return nodes.map(walk).filter((item): item is DepartmentTreeNode => item !== null);
}

export function getDefaultExpandedDepartmentIds(nodes: DepartmentTreeNode[], maxExpandDepth = 3): string[] {
  const ids: string[] = [];

  function walk(nodeList: DepartmentTreeNode[], depth: number) {
    for (const node of nodeList) {
      if (node.children.length && depth < maxExpandDepth) {
        ids.push(node.department.id);
        walk(node.children, depth + 1);
      }
    }
  }

  walk(nodes, 0);
  return ids;
}
