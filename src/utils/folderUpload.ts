export interface FolderUploadFile {
  file: File;
  relativePath: string;
}

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

export function collectFilesFromFileList(files: FileList | File[]): FolderUploadFile[] {
  return [...files].map((file) => ({ file, relativePath: fileRelativePath(file) }));
}

export async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<FolderUploadFile[]> {
  const items = dataTransfer.items;
  if (!items?.length) {
    return collectFilesFromFileList(dataTransfer.files);
  }

  const collected: FolderUploadFile[] = [];
  const walkers: Promise<void>[] = [];
  for (const item of items) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (!entry) continue;
    walkers.push(walkFileTree(entry, "", collected));
  }

  if (walkers.length) {
    await Promise.all(walkers);
    return collected;
  }
  return collectFilesFromFileList(dataTransfer.files);
}

export function titleFromRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || normalized;
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}
