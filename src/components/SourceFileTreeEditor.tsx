import {
  ChevronRightIcon,
  FileDirectoryFillIcon,
  FileDirectoryOpenFillIcon
} from "@primer/octicons-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  getDefaultExpandedFolderPaths,
  type SourceTreeNode,
  type SourceTreeRoot
} from "@/utils/sourceFileTree";
import { getGithubFileIconColorClass, getGithubFileIconComponent } from "@/utils/githubFileIcons";
import styles from "./SourceFileTreeEditor.module.css";

const STAGED_FILE_MIME = "application/x-staged-file-id";
const DEFAULT_NEW_FOLDER_NAME = "Новая папка";

type PendingCreate = {
  parentPath: string;
  depth: number;
};

type ContextMenuState = {
  x: number;
  y: number;
  parentPath: string;
  depth: number;
};

function formatBytes(value?: number) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function parentPathOf(relativePath: string) {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
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

function readStagedFileId(dataTransfer: DataTransfer) {
  return dataTransfer.getData(STAGED_FILE_MIME) || dataTransfer.getData("text/plain");
}

function PendingFolderRow({
  depth,
  defaultName,
  error,
  onConfirm,
  onCancel
}: {
  depth: number;
  defaultName: string;
  error: string | null;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  useEffect(() => {
    if (!error) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [error]);

  return (
    <li className={styles.pendingFolderRow} style={{ paddingLeft: `${8 + depth * 16}px` }}>
      <span className={styles.chevronSpacer} aria-hidden="true" />
      <span className={`${styles.iconCell} ${styles.folderIcon}`} aria-hidden="true">
        <FileDirectoryFillIcon size={16} />
      </span>
      <div className={styles.pendingFolderField}>
        <input
          ref={inputRef}
          className={`${styles.pendingFolderInput} ${error ? styles.pendingFolderInputError : ""}`}
          defaultValue={defaultName}
          aria-label="Имя новой папки"
          aria-invalid={Boolean(error)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              onConfirm(event.currentTarget.value);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          onBlur={(event) => {
            const name = event.currentTarget.value.trim();
            if (!name) {
              onCancel();
              return;
            }
            onConfirm(name);
          }}
        />
        {error ? <span className={styles.pendingFolderError}>{error}</span> : null}
      </div>
    </li>
  );
}

function TreeNodeRow({
  node,
  depth,
  expandedPaths,
  dropTargetPath,
  pendingCreate,
  createError,
  onToggleFolder,
  onDropTargetChange,
  onMoveFile,
  onOpenContextMenu,
  onConfirmCreate,
  onCancelCreate
}: {
  node: SourceTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  dropTargetPath: string | null;
  pendingCreate: PendingCreate | null;
  createError: string | null;
  onToggleFolder: (path: string) => void;
  onDropTargetChange: (path: string | null) => void;
  onMoveFile: (fileId: string, targetFolderPath: string) => void;
  onOpenContextMenu: (event: MouseEvent, parentPath: string, depth: number) => void;
  onConfirmCreate: (name: string) => void;
  onCancelCreate: () => void;
}) {
  if (node.kind === "file") {
    return (
      <li
        className={styles.row}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        draggable
        onContextMenu={(event) => onOpenContextMenu(event, parentPathOf(node.relativePath), depth)}
        onDragStart={(event) => {
          event.dataTransfer.setData(STAGED_FILE_MIME, node.id);
          event.dataTransfer.effectAllowed = "move";
        }}
      >
        <span className={styles.chevronSpacer} aria-hidden="true" />
        <FileTypeIcon filename={node.name} />
        <span className={styles.nodeName} title={node.relativePath}>
          {node.name}
        </span>
        {node.fileSize ? <span className={styles.nodeMeta}>{formatBytes(node.fileSize)}</span> : null}
      </li>
    );
  }

  const isOpen = expandedPaths.has(node.relativePath) || pendingCreate?.parentPath === node.relativePath;
  const isDropTarget = dropTargetPath === node.relativePath;
  const FolderIcon = isOpen ? FileDirectoryOpenFillIcon : FileDirectoryFillIcon;
  const showPendingInside = pendingCreate?.parentPath === node.relativePath;

  return (
    <li className={styles.folderBlock}>
      <div
        className={`${styles.folderDropZone} ${isDropTarget ? styles.folderDropZoneActive : ""}`}
        onContextMenu={(event) => onOpenContextMenu(event, node.relativePath, depth + 1)}
        onDragOver={(event) => {
          if (!readStagedFileId(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDropTargetChange(node.relativePath);
        }}
        onDragLeave={() => onDropTargetChange(null)}
        onDrop={(event) => {
          const fileId = readStagedFileId(event.dataTransfer);
          if (!fileId) return;
          event.preventDefault();
          event.stopPropagation();
          onDropTargetChange(null);
          onMoveFile(fileId, node.relativePath);
        }}
      >
        <button
          type="button"
          className={styles.row}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          aria-expanded={isOpen}
          onClick={() => onToggleFolder(node.relativePath)}
          onContextMenu={(event) => onOpenContextMenu(event, node.relativePath, depth + 1)}
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
      </div>
      {isOpen ? (
        <ul className={styles.children}>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.kind === "file" ? child.id : child.relativePath}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              dropTargetPath={dropTargetPath}
              pendingCreate={pendingCreate}
              createError={createError}
              onToggleFolder={onToggleFolder}
              onDropTargetChange={onDropTargetChange}
              onMoveFile={onMoveFile}
              onOpenContextMenu={onOpenContextMenu}
              onConfirmCreate={onConfirmCreate}
              onCancelCreate={onCancelCreate}
            />
          ))}
          {showPendingInside ? (
            <PendingFolderRow
              depth={depth + 1}
              defaultName={DEFAULT_NEW_FOLDER_NAME}
              error={createError}
              onConfirm={onConfirmCreate}
              onCancel={onCancelCreate}
            />
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

function ContextMenu({
  state,
  onCreateFolder,
  onClose
}: {
  state: ContextMenuState;
  onCreateFolder: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={styles.contextMenuBackdrop}
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className={styles.contextMenu}
        style={{ top: state.y, left: state.x }}
        role="menu"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.contextMenuItem} role="menuitem" onClick={onCreateFolder}>
          Создать папку
        </button>
      </div>
    </div>
  );
}

export default function SourceFileTreeEditor({
  tree,
  onCreateFolder,
  onMoveFile
}: {
  tree: SourceTreeRoot;
  onCreateFolder: (parentPath: string, name: string) => boolean;
  onMoveFile: (fileId: string, targetFolderPath: string) => void;
}) {
  const defaultExpanded = useMemo(
    () => new Set(getDefaultExpandedFolderPaths(tree)),
    [tree.fileCount, tree.folderCount]
  );
  const [expandedPaths, setExpandedPaths] = useState(defaultExpanded);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setExpandedPaths(new Set(getDefaultExpandedFolderPaths(tree)));
  }, [tree.fileCount, tree.folderCount]);

  const openContextMenu = useCallback((event: MouseEvent, parentPath: string, depth: number) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, parentPath, depth });
  }, []);

  const startCreateFolder = useCallback(() => {
    if (!contextMenu) return;
    setCreateError(null);
    setPendingCreate({ parentPath: contextMenu.parentPath, depth: contextMenu.depth });
    if (contextMenu.parentPath) {
      setExpandedPaths((current) => new Set([...current, contextMenu.parentPath]));
    }
    setContextMenu(null);
  }, [contextMenu]);

  const cancelCreate = useCallback(() => {
    setPendingCreate(null);
    setCreateError(null);
  }, []);

  const confirmCreate = useCallback(
    (rawName: string) => {
      if (!pendingCreate) return;
      const created = onCreateFolder(pendingCreate.parentPath, rawName);
      if (!created) {
        setCreateError("Папка с таким именем уже существует");
        return;
      }
      setPendingCreate(null);
      setCreateError(null);
      if (pendingCreate.parentPath) {
        setExpandedPaths((current) => new Set([...current, pendingCreate.parentPath]));
      }
    },
    [onCreateFolder, pendingCreate]
  );

  function toggleFolder(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const openRootContextMenu = useCallback((event: MouseEvent) => {
    openContextMenu(event, "", 0);
  }, [openContextMenu]);

  return (
    <div className={styles.editor}>
      <div
        className={`${styles.treeSurface} ${dropTargetPath === "" ? styles.folderDropZoneActive : ""}`}
        onContextMenu={openRootContextMenu}
        onDragOver={(event) => {
          if (!readStagedFileId(event.dataTransfer)) return;
          event.preventDefault();
          setDropTargetPath("");
        }}
        onDragLeave={() => {
          if (dropTargetPath === "") setDropTargetPath(null);
        }}
        onDrop={(event) => {
          const fileId = readStagedFileId(event.dataTransfer);
          if (!fileId) return;
          event.preventDefault();
          setDropTargetPath(null);
          onMoveFile(fileId, "");
        }}
      >
        {!tree.children.length && !pendingCreate ? (
          <p className={styles.empty}>Правый клик — создать папку. Перетащите файлы для структуры базы знаний.</p>
        ) : (
          <ul className={styles.rootList}>
            {tree.children.map((node) => (
              <TreeNodeRow
                key={node.kind === "file" ? node.id : node.relativePath}
                node={node}
                depth={0}
                expandedPaths={expandedPaths}
                dropTargetPath={dropTargetPath}
                pendingCreate={pendingCreate}
                createError={createError}
                onToggleFolder={toggleFolder}
                onDropTargetChange={setDropTargetPath}
                onMoveFile={onMoveFile}
                onOpenContextMenu={openContextMenu}
                onConfirmCreate={confirmCreate}
                onCancelCreate={cancelCreate}
              />
            ))}
            {pendingCreate?.parentPath === "" ? (
              <PendingFolderRow
                depth={0}
                defaultName={DEFAULT_NEW_FOLDER_NAME}
                error={createError}
                onConfirm={confirmCreate}
                onCancel={cancelCreate}
              />
            ) : null}
          </ul>
        )}
      </div>

      {contextMenu
        ? createPortal(
            <ContextMenu state={contextMenu} onCreateFolder={startCreateFolder} onClose={() => setContextMenu(null)} />,
            document.body
          )
        : null}
    </div>
  );
}
