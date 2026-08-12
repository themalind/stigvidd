// Staged uploads survive a page refresh: the picked files live in IndexedDB
// (it structured-clones `File`, which localStorage cannot) and the chosen
// upload target in localStorage. Everything here is best-effort — a failing
// store must never block uploading, so errors resolve to "nothing staged".

const DB_NAME = "stigvidd-media";
const STORE = "staged";
const FILES_KEY = "files";
const TARGET_KEY = "stigvidd:media-upload-target";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// `close()` waits for the pending transaction, so it is safe in `finally`.
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function loadStagedFiles(): Promise<File[]> {
  try {
    const stored = await withStore<unknown>("readonly", (s) =>
      s.get(FILES_KEY),
    );
    if (!Array.isArray(stored)) return [];
    return stored.filter((f): f is File => f instanceof File);
  } catch {
    return [];
  }
}

export async function saveStagedFiles(files: File[]): Promise<void> {
  try {
    if (files.length === 0) {
      await withStore<undefined>("readwrite", (s) => s.delete(FILES_KEY));
      return;
    }
    await withStore<IDBValidKey>("readwrite", (s) => s.put(files, FILES_KEY));
  } catch {
    // Ignore: staging is a convenience, not part of the upload path.
  }
}

export type StagedTarget = { targetType: string; targetId: string };

export function loadStagedTarget(): StagedTarget | null {
  try {
    const raw = localStorage.getItem(TARGET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StagedTarget>;
    if (typeof parsed?.targetType !== "string") return null;
    return {
      targetType: parsed.targetType,
      targetId: typeof parsed.targetId === "string" ? parsed.targetId : "",
    };
  } catch {
    return null;
  }
}

export function saveStagedTarget(target: StagedTarget): void {
  try {
    localStorage.setItem(TARGET_KEY, JSON.stringify(target));
  } catch {
    // Ignore: see saveStagedFiles.
  }
}
