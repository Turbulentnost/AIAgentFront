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

export async function collectDroppedSourceFiles(
  dataTransfer: DataTransfer,
  acceptFile: (file: File) => boolean
): Promise<DroppedSourceFile[]> {
  const items = [...dataTransfer.items];
  const results: DroppedSourceFile[] = [];

  if (items.length) {
    for (const item of items) {
      if (item.kind !== "file") continue;

      const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntryLike | null }).webkitGetAsEntry?.();
      if (entry) {
        await traverseEntry(entry, "", acceptFile, results);
        continue;
      }

      const file = item.getAsFile();
      if (file && acceptFile(file)) {
        results.push({ file, relativePath: relativePathFromFile(file) });
      }
    }
  } else {
    for (const file of [...dataTransfer.files]) {
      if (acceptFile(file)) {
        results.push({ file, relativePath: relativePathFromFile(file) });
      }
    }
  }

  const unique = new Map<string, DroppedSourceFile>();
  for (const item of results) {
    unique.set(`${item.relativePath}:${item.file.size}:${item.file.lastModified}`, item);
  }

  return [...unique.values()];
}

export type { DroppedSourceFile };
