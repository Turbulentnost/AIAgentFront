import {
  ChevronRightIcon,
  FileDirectoryFillIcon,
  FileDirectoryOpenFillIcon
} from "@primer/octicons-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getDefaultExpandedFolderPaths,
  type SourceTreeNode,
  type SourceTreeRoot
} from "@/utils/sourceFileTree";
import { getGithubFileIconColorClass, getGithubFileIconComponent } from "@/utils/githubFileIcons";
import styles from "./SourceFileTree.module.css";

export type SourceFileTreeFileMeta = {
  statusLabel?: string;
  metaText?: string;
  trailing?: ReactNode;
};

function formatBytes(value?: number) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function FileTypeIcon({ filename }: { filename: string }) {
  const Icon = getGithubFileIconComponent(filename);
  const colorClass = getGithubFileIconColorClass(filename);

  return (
    <span
      className={`${styles.iconCell} ${styles.fileIcon} ${styles[colorClass as keyof typeof styles] ?? styles.fileIcon_default}`}
      aria-hidden="true"
    >
      <Icon size={16} />
    </span>
  );
}

function TreeNodeRow({
  node,
  depth,
  expandedPaths,
  fileMetaById,
  selectedFileId,
  onToggleFolder,
  onFileSelect
}: {
  node: SourceTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  fileMetaById?: Record<string, SourceFileTreeFileMeta>;
  selectedFileId?: string | null;
  onToggleFolder: (path: string) => void;
  onFileSelect?: (fileId: string) => void;
}) {
  if (node.kind === "file") {
    const fileMeta = fileMetaById?.[node.id];
    const isSelected = selectedFileId === node.id;

    return (
      <li
        className={`${styles.row} ${fileMeta ? styles.rowRich : ""} ${isSelected ? styles.rowSelected : ""}`.trim()}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span className={styles.chevronSpacer} aria-hidden="true" />
        <FileTypeIcon filename={node.name} />
        <button
          type="button"
          className={styles.fileNameButton}
          title={node.relativePath}
          onClick={() => onFileSelect?.(node.id)}
        >
          {node.name}
        </button>
        {fileMeta?.statusLabel ? <span className={styles.nodeStatus}>{fileMeta.statusLabel}</span> : null}
        {fileMeta?.metaText ? (
          <span className={styles.nodeMeta}>{fileMeta.metaText}</span>
        ) : node.fileSize ? (
          <span className={styles.nodeMeta}>{formatBytes(node.fileSize)}</span>
        ) : null}
        {fileMeta?.trailing ? <span className={styles.nodeTrailing}>{fileMeta.trailing}</span> : null}
      </li>
    );
  }

  const isOpen = expandedPaths.has(node.relativePath);
  const FolderIcon = isOpen ? FileDirectoryOpenFillIcon : FileDirectoryFillIcon;

  return (
    <li className={styles.folderBlock}>
      <button
        type="button"
        className={styles.row}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        aria-expanded={isOpen}
        onClick={() => onToggleFolder(node.relativePath)}
      >
        <span className={styles.chevronWrap} aria-hidden="true">
          <ChevronRightIcon
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
            size={12}
          />
        </span>
        <span className={`${styles.iconCell} ${styles.folderIcon}`} aria-hidden="true">
          <FolderIcon size={16} />
        </span>
        <span className={styles.nodeName}>{node.name}</span>
      </button>
      {isOpen ? (
        <ul className={styles.children}>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.kind === "file" ? child.id : child.relativePath}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              fileMetaById={fileMetaById}
              selectedFileId={selectedFileId}
              onToggleFolder={onToggleFolder}
              onFileSelect={onFileSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function SourceFileTree({
  tree,
  defaultExpandAll = true,
  className,
  fileMetaById,
  selectedFileId,
  onFileSelect
}: {
  tree: SourceTreeRoot;
  defaultExpandAll?: boolean;
  className?: string;
  fileMetaById?: Record<string, SourceFileTreeFileMeta>;
  selectedFileId?: string | null;
  onFileSelect?: (fileId: string) => void;
}) {
  const defaultExpanded = useMemo(
    () => (defaultExpandAll ? new Set(getDefaultExpandedFolderPaths(tree)) : new Set<string>()),
    [defaultExpandAll, tree]
  );
  const [expandedPaths, setExpandedPaths] = useState(defaultExpanded);

  useEffect(() => {
    setExpandedPaths(defaultExpandAll ? new Set(getDefaultExpandedFolderPaths(tree)) : new Set());
  }, [defaultExpandAll, tree.fileCount, tree.folderCount]);

  function toggleFolder(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  if (!tree.children.length) {
    return <p className={styles.empty}>Файлы не добавлены</p>;
  }

  return (
    <div className={`${styles.tree} ${className ?? ""}`.trim()}>
      <ul className={styles.rootList}>
        {tree.children.map((node) => (
          <TreeNodeRow
            key={node.kind === "file" ? node.id : node.relativePath}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            fileMetaById={fileMetaById}
            selectedFileId={selectedFileId}
            onToggleFolder={toggleFolder}
            onFileSelect={onFileSelect}
          />
        ))}
      </ul>
    </div>
  );
}
