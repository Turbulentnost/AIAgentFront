export type SourceTreeFileInput = {
  id: string;
  relativePath: string;
  fileSize?: number;
};

export type SourceTreeFileNode = {
  kind: "file";
  id: string;
  name: string;
  relativePath: string;
  fileSize?: number;
};

export type SourceTreeFolderNode = {
  kind: "folder";
  name: string;
  relativePath: string;
  children: SourceTreeNode[];
};

export type SourceTreeNode = SourceTreeFileNode | SourceTreeFolderNode;

export type SourceTreeRoot = {
  children: SourceTreeNode[];
  fileCount: number;
  folderCount: number;
};

function normalizeRelativePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function compareTreeNodes(a: SourceTreeNode, b: SourceTreeNode) {
  if (a.kind !== b.kind) {
    return a.kind === "folder" ? -1 : 1;
  }
  return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
}

function sortTreeNodes(nodes: SourceTreeNode[]) {
  nodes.sort(compareTreeNodes);
  for (const node of nodes) {
    if (node.kind === "folder") sortTreeNodes(node.children);
  }
}

function countTreeNodes(nodes: SourceTreeNode[]) {
  let fileCount = 0;
  let folderCount = 0;

  for (const node of nodes) {
    if (node.kind === "file") {
      fileCount += 1;
      continue;
    }
    folderCount += 1;
    const nested = countTreeNodes(node.children);
    fileCount += nested.fileCount;
    folderCount += nested.folderCount;
  }

  return { fileCount, folderCount };
}

function getOrCreateFolder(parent: SourceTreeFolderNode, folderName: string, folderPath: string) {
  const existing = parent.children.find(
    (child): child is SourceTreeFolderNode => child.kind === "folder" && child.name === folderName
  );
  if (existing) return existing;

  const folder: SourceTreeFolderNode = {
    kind: "folder",
    name: folderName,
    relativePath: folderPath,
    children: []
  };
  parent.children.push(folder);
  return folder;
}

export function buildSourceFileTree(items: SourceTreeFileInput[]): SourceTreeRoot {
  const root: SourceTreeFolderNode = {
    kind: "folder",
    name: "",
    relativePath: "",
    children: []
  };

  for (const item of items) {
    const normalizedPath = normalizeRelativePath(item.relativePath);
    if (!normalizedPath) continue;

    const segments = normalizedPath.split("/").filter(Boolean);
    if (!segments.length) continue;

    const fileName = segments.pop()!;
    let currentFolder = root;
    let folderPath = "";

    for (const segment of segments) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;
      currentFolder = getOrCreateFolder(currentFolder, segment, folderPath);
    }

    currentFolder.children.push({
      kind: "file",
      id: item.id,
      name: fileName,
      relativePath: normalizedPath,
      fileSize: item.fileSize
    });
  }

  sortTreeNodes(root.children);
  const stats = countTreeNodes(root.children);

  return {
    children: root.children,
    fileCount: stats.fileCount,
    folderCount: stats.folderCount
  };
}

export function collectFolderPaths(nodes: SourceTreeNode[], parentPath = ""): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.kind !== "folder") continue;
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    paths.push(node.relativePath || path, ...collectFolderPaths(node.children, path));
  }

  return paths;
}

export function getDefaultExpandedFolderPaths(tree: SourceTreeRoot) {
  return collectFolderPaths(tree.children);
}

export function findTreeNodeByPath(nodes: SourceTreeNode[], relativePath: string): SourceTreeNode | null {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) return null;

  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length) return null;

  let currentNodes = nodes;
  let currentNode: SourceTreeNode | null = null;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    currentNode = currentNodes.find((node) => node.name === segment) ?? null;
    if (!currentNode) return null;
    if (isLast) return currentNode;
    if (currentNode.kind !== "folder") return null;
    currentNodes = currentNode.children;
  }

  return currentNode;
}
