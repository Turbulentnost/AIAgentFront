export interface FolderUploadFile {
  file: File;
  relativePath: string;
}

type SyncTransferItem =
  | { kind: "entry"; entry: FileSystemEntry }
  | { kind: "file"; file: File };

function fileRelativePath(file: File): string {
  const withPath = file as File & { webkitRelativePath?: string };
  return withPath.webkitRelativePath?.trim() || file.name;
}

function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: FileSystemEntry[] = [];
    const readBatch = () => {
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
    };
    readBatch();
  });
}

async function walkFileTree(entry: FileSystemEntry, parentPath: string, out: FolderUploadFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    const relativePath = parentPath ? `${parentPath}/${file.name}` : file.name;
    out.push({ file, relativePath });
    return;
  }
  if (!entry.isDirectory) return;
  const nextPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children = await readDirectoryEntries(reader);
  for (const child of children) {
    await walkFileTree(child, nextPath, out);
  }
}

function collectSyncItems(dataTransfer: DataTransfer): SyncTransferItem[] {
  const syncItems: SyncTransferItem[] = [];

  if (dataTransfer.items?.length) {
    for (const item of dataTransfer.items) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.();
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

export function collectFilesFromFileList(files: FileList | File[]): FolderUploadFile[] {
  return [...files].map((file) => ({ file, relativePath: fileRelativePath(file) }));
}

export async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<FolderUploadFile[]> {
  const syncItems = collectSyncItems(dataTransfer);
  const collected: FolderUploadFile[] = [];

  for (const item of syncItems) {
    if (item.kind === "entry") {
      await walkFileTree(item.entry, "", collected);
      continue;
    }
    collected.push({ file: item.file, relativePath: fileRelativePath(item.file) });
  }

  return collected;
}

export function titleFromRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || normalized;
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}
