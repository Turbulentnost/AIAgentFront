import { createId } from "./createId";

const DB_NAME = "aveon-workbook-preview";
const STORE_NAME = "files";
const DB_VERSION = 1;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type StoredWorkbookFile = {
  id: string;
  fileName: string;
  mime: string;
  blob: Blob;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB недоступна"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
  });
}

export async function putWorkbookFile(id: string, file: File): Promise<void> {
  const record: StoredWorkbookFile = {
    id,
    fileName: file.name,
    mime: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    blob: file,
    createdAt: Date.now()
  };
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Не удалось сохранить файл для вкладки"));
    });
  } finally {
    db.close();
  }
  void sweepExpiredWorkbooks();
}

export async function getWorkbookFile(id: string): Promise<StoredWorkbookFile | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const record = await requestToPromise(
      tx.objectStore(STORE_NAME).get(id) as IDBRequest<StoredWorkbookFile | undefined>
    );
    return record ?? null;
  } finally {
    db.close();
  }
}

async function sweepExpiredWorkbooks(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const rows = await requestToPromise(store.getAll() as IDBRequest<StoredWorkbookFile[]>);
    const now = Date.now();
    for (const row of rows) {
      if (!row?.createdAt || now - row.createdAt > MAX_AGE_MS) {
        store.delete(row.id);
      }
    }
  } catch {
    // очистка кэша не должна ломать открытие файла
  } finally {
    db.close();
  }
}

export function workbookPreviewPath(id: string): string {
  const route = `/agents/document-analysis/workbook/${encodeURIComponent(id)}`;
  if (typeof window !== "undefined" && window.aveonDesktop?.platform === "electron") {
    return `#${route}`;
  }
  return route;
}

export async function openWorkbookInNewTab(file: File): Promise<void> {
  const id = createId();
  const path = workbookPreviewPath(id);
  const tab = window.open(path, "_blank");
  await putWorkbookFile(id, file);
  if (!tab) {
    throw new Error("Браузер заблокировал новую вкладку. Разрешите всплывающие окна для этого сайта.");
  }
}
