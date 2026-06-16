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

function RichRowSpacers() {
  return (
    <>
      <span className={`${styles.nodeStatus} ${styles.nodeStatusEmpty}`} aria-hidden="true" />
      <span className={`${styles.nodeMeta} ${styles.nodeMetaEmpty}`} aria-hidden="true" />
      <span className={`${styles.nodeTrailing} ${styles.nodeTrailingEmpty}`} aria-hidden="true" />
    </>
  );
}

function TreeNodeRow({
  node,
  depth,
  expandedPaths,
  fileMetaById,
  richLayout,
  selectedFileId,
  onToggleFolder,
  onFileSelect
}: {
  node: SourceTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  fileMetaById?: Record<string, SourceFileTreeFileMeta>;
  richLayout: boolean;
  selectedFileId?: string | null;
  onToggleFolder: (path: string) => void;
  onFileSelect?: (fileId: string) => void;
}) {
  const indentStyle = richLayout ? { paddingLeft: `${depth * 16}px` } : { paddingLeft: `${8 + depth * 16}px` };

  if (node.kind === "file") {
    const fileMeta = fileMetaById?.[node.id];
    const isSelected = selectedFileId === node.id;
    const useRichRow = richLayout || Boolean(fileMeta);

    return (
      <li
        className={`${styles.row} ${useRichRow ? styles.rowRich : ""} ${isSelected ? styles.rowSelected : ""}`.trim()}
        style={useRichRow ? undefined : indentStyle}
        onClick={() => onFileSelect?.(node.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onFileSelect?.(node.id);
          }
        }}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
      >
        <span className={styles.chevronSpacer} aria-hidden="true" />
        <FileTypeIcon filename={node.name} />
        <span className={useRichRow ? styles.nameCell : undefined} style={useRichRow ? indentStyle : undefined}>
          <span className={styles.fileNameButton} title={node.relativePath}>
            {node.name}
          </span>
        </span>
        {useRichRow ? (
          <>
            {fileMeta?.statusLabel ? (
              <span className={styles.nodeStatus}>{fileMeta.statusLabel}</span>
            ) : (
              <span className={`${styles.nodeStatus} ${styles.nodeStatusEmpty}`} aria-hidden="true" />
            )}
            {fileMeta?.metaText ? (
              <span className={styles.nodeMeta}>{fileMeta.metaText}</span>
            ) : (
              <span className={`${styles.nodeMeta} ${styles.nodeMetaEmpty}`} aria-hidden="true" />
            )}
            {fileMeta?.trailing ? (
              <span className={styles.nodeTrailing} onClick={(event) => event.stopPropagation()}>
                {fileMeta.trailing}
              </span>
            ) : (
              <span className={`${styles.nodeTrailing} ${styles.nodeTrailingEmpty}`} aria-hidden="true" />
            )}
          </>
        ) : null}
      </li>
    );
  }

  const isOpen = expandedPaths.has(node.relativePath);
  const FolderIcon = isOpen ? FileDirectoryOpenFillIcon : FileDirectoryFillIcon;
  const rowClassName = `${styles.row} ${richLayout ? styles.rowRich : ""}`.trim();

  return (
    <li className={styles.folderBlock}>
      <button
        type="button"
        className={rowClassName}
        style={richLayout ? undefined : indentStyle}
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
        <span className={richLayout ? styles.nameCell : undefined} style={richLayout ? indentStyle : undefined}>
          <span className={styles.nodeName}>{node.name}</span>
        </span>
        {richLayout ? <RichRowSpacers /> : null}
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
              richLayout={richLayout}
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
  richLayout: richLayoutProp,
  selectedFileId,
  onFileSelect
}: {
  tree: SourceTreeRoot;
  defaultExpandAll?: boolean;
  className?: string;
  fileMetaById?: Record<string, SourceFileTreeFileMeta>;
  richLayout?: boolean;
  selectedFileId?: string | null;
  onFileSelect?: (fileId: string) => void;
}) {
  const richLayout = richLayoutProp ?? Boolean(fileMetaById);
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
    <div className={`${styles.tree} ${richLayout ? styles.treeRich : ""} ${className ?? ""}`.trim()}>
      <ul className={styles.rootList}>
        {tree.children.map((node) => (
          <TreeNodeRow
            key={node.kind === "file" ? node.id : node.relativePath}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            fileMetaById={fileMetaById}
            richLayout={richLayout}
            selectedFileId={selectedFileId}
            onToggleFolder={toggleFolder}
            onFileSelect={onFileSelect}
          />
        ))}
      </ul>
    </div>
  );
}
