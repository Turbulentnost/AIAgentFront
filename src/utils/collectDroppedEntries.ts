type DroppedSourceFile = {
  file: File;
  relativePath: string;
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
};

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (error: DOMException) => void
    ) => void;
  };
};

type SyncDroppedItem =
  | { kind: "entry"; entry: FileSystemEntryLike }
  | { kind: "file"; file: File };

function readAllDirectoryEntries(reader: ReturnType<FileSystemDirectoryEntryLike["createReader"]>) {
  return new Promise<FileSystemEntryLike[]>((resolve, reject) => {
    const entries: FileSystemEntryLike[] = [];

    function readBatch() {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        },
        (error) => reject(error)
      );
    }

    readBatch();
  });
}

async function traverseEntry(
  entry: FileSystemEntryLike,
  parentPath: string,
  acceptFile: (file: File) => boolean,
  results: DroppedSourceFile[]
) {
  if (entry.isFile) {
    const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    await new Promise<void>((resolve) => {
      (entry as FileSystemFileEntryLike).file(
        (file) => {
          if (acceptFile(file)) {
            results.push({ file, relativePath });
          }
          resolve();
        },
        () => resolve()
      );
    });
    return;
  }

  if (!entry.isDirectory) return;

  const dirPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  const reader = (entry as FileSystemDirectoryEntryLike).createReader();
  const children = await readAllDirectoryEntries(reader);
  for (const child of children) {
    await traverseEntry(child, dirPath, acceptFile, results);
  }
}

function normalizeRelativePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function relativePathFromFile(file: File) {
  const withPath = file as File & { webkitRelativePath?: string };
  const relativePath = normalizeRelativePath(withPath.webkitRelativePath || file.name);
  return relativePath;
}

function collectSyncItems(dataTransfer: DataTransfer): SyncDroppedItem[] {
  const syncItems: SyncDroppedItem[] = [];

  if (dataTransfer.items?.length) {
    for (const item of dataTransfer.items) {
      if (item.kind !== "file") continue;

      const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntryLike | null }).webkitGetAsEntry?.();
      if (entry) {
        syncItems.push({ kind: "entry", entry });
        continue;
      }

      const file = item.getAsFile();
      if (file) syncItems.push({ kind: "file", file });
    }
  }

  if (!syncItems.length && dataTransfer.files?.length) {
    for (const file of dataTransfer.files) {
      syncItems.push({ kind: "file", file });
    }
  }

  return syncItems;
}

export async function collectDroppedSourceFiles(
  dataTransfer: DataTransfer,
  acceptFile: (file: File) => boolean
): Promise<DroppedSourceFile[]> {
  const syncItems = collectSyncItems(dataTransfer);
  const results: DroppedSourceFile[] = [];

  for (const item of syncItems) {
    if (item.kind === "entry") {
      await traverseEntry(item.entry, "", acceptFile, results);
      continue;
    }
    if (acceptFile(item.file)) {
      results.push({ file: item.file, relativePath: relativePathFromFile(item.file) });
    }
  }

  const unique = new Map<string, DroppedSourceFile>();
  for (const result of results) {
    unique.set(`${result.relativePath}:${result.file.size}:${result.file.lastModified}`, result);
  }

  return [...unique.values()];
}

export type { DroppedSourceFile };
