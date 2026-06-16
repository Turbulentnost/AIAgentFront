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

export function normalizeFolderPath(path: string) {
  return normalizeRelativePath(path);
}

export function sanitizeFolderName(name: string) {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ");
  return cleaned || null;
}

export function buildFolderPath(parentPath: string, name: string) {
  const folderName = sanitizeFolderName(name);
  if (!folderName) return null;
  const parent = normalizeFolderPath(parentPath);
  return parent ? `${parent}/${folderName}` : folderName;
}

export function buildFileRelativePath(folderPath: string, fileName: string) {
  const folder = normalizeFolderPath(folderPath);
  const normalizedName = normalizeRelativePath(fileName);
  const baseName = normalizedName.split("/").filter(Boolean).pop() || normalizedName;
  if (!baseName) return folder;
  return folder ? `${folder}/${baseName}` : baseName;
}

export function moveFileRelativePath(currentPath: string, targetFolderPath: string) {
  const fileName = normalizeRelativePath(currentPath).split("/").filter(Boolean).pop() || currentPath;
  return buildFileRelativePath(targetFolderPath, fileName);
}

export function isPathInsideFolder(folderPath: string, candidatePath: string) {
  const folder = normalizeFolderPath(folderPath);
  const candidate = normalizeFolderPath(candidatePath);
  if (!folder) return !candidate;
  if (!candidate) return false;
  if (candidate === folder) return true;
  return candidate.startsWith(`${folder}/`);
}

export function remapPathUnderFolder(path: string, sourceFolderPath: string, newFolderRootPath: string) {
  const normalized = normalizeRelativePath(path);
  const source = normalizeFolderPath(sourceFolderPath);
  const newRoot = normalizeFolderPath(newFolderRootPath);
  if (!source) return normalized;
  if (normalized === source || normalized.startsWith(`${source}/`)) {
    const suffix = normalized.slice(source.length);
    return `${newRoot}${suffix}`;
  }
  return normalized;
}

export function moveFolderSubtreeRootPath(sourceFolderPath: string, targetFolderPath: string) {
  const segments = normalizeFolderPath(sourceFolderPath).split("/").filter(Boolean);
  const folderName = segments.pop();
  if (!folderName) return normalizeFolderPath(sourceFolderPath);
  return buildFolderPath(targetFolderPath, folderName) ?? normalizeFolderPath(sourceFolderPath);
}

export function canMoveFolderToTarget(sourceFolderPath: string, targetFolderPath: string) {
  const source = normalizeFolderPath(sourceFolderPath);
  const target = normalizeFolderPath(targetFolderPath);
  if (!source) return false;
  if (source === target) return false;
  if (isPathInsideFolder(source, target)) return false;
  return true;
}

function cloneTreeNode(node: SourceTreeNode): SourceTreeNode {
  if (node.kind === "file") return { ...node };
  return {
    kind: "folder",
    name: node.name,
    relativePath: node.relativePath,
    children: node.children.map(cloneTreeNode)
  };
}

export function mergeCustomFoldersIntoTree(tree: SourceTreeRoot, customFolderPaths: string[]): SourceTreeRoot {
  const root: SourceTreeFolderNode = {
    kind: "folder",
    name: "",
    relativePath: "",
    children: tree.children.map(cloneTreeNode)
  };

  for (const rawPath of customFolderPaths) {
    const normalizedPath = normalizeFolderPath(rawPath);
    if (!normalizedPath) continue;

    const segments = normalizedPath.split("/").filter(Boolean);
    let currentFolder = root;
    let folderPath = "";

    for (const segment of segments) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;
      currentFolder = getOrCreateFolder(currentFolder, segment, folderPath);
    }
  }

  sortTreeNodes(root.children);
  const stats = countTreeNodes(root.children);

  return {
    children: root.children,
    fileCount: stats.fileCount,
    folderCount: stats.folderCount
  };
}

export function collectAllFolderPaths(tree: SourceTreeRoot) {
  return new Set(collectFolderPaths(tree.children));
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

function shouldCollapseFolderChain(folder: SourceTreeFolderNode) {
  const files = folder.children.filter((child) => child.kind === "file");
  const folders = folder.children.filter((child) => child.kind === "folder");
  return files.length === 0 && folders.length === 1;
}

function collapseFolderNode(folder: SourceTreeFolderNode): SourceTreeFolderNode {
  const names = [folder.name];
  let current = folder;

  while (shouldCollapseFolderChain(current)) {
    const nextFolder = current.children.find((child): child is SourceTreeFolderNode => child.kind === "folder");
    if (!nextFolder) break;
    current = nextFolder;
    names.push(current.name);
  }

  return {
    kind: "folder",
    name: names.join(" / "),
    relativePath: current.relativePath,
    children: current.children.map((child) => (child.kind === "folder" ? collapseFolderNode(child) : child))
  };
}

export function collapseLinearFolderChains(nodes: SourceTreeNode[]): SourceTreeNode[] {
  return nodes.map((node) => (node.kind === "folder" ? collapseFolderNode(node) : node));
}

export function collapseLinearFolderChainsInTree(tree: SourceTreeRoot): SourceTreeRoot {
  const children = collapseLinearFolderChains(tree.children);
  const stats = countTreeNodes(children);

  return {
    children,
    fileCount: stats.fileCount,
    folderCount: stats.folderCount
  };
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
