// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Staged uploads survive a page refresh: the picked image data lives in
// IndexedDB (it stores binary, which localStorage cannot) and the chosen upload
// target in localStorage. Everything here is best-effort — a failing store must
// never block uploading, so errors resolve to "nothing staged".

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

// Stored as bytes rather than as the picked `File`: a `File` is only a reference
// to the file on disk, and the document that comes back after a refresh can no
// longer read it — the upload then stalls instead of failing, because the request
// still advertises the snapshot size. A `Blob` built here holds an owned copy.
interface StagedFile {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

function isStagedFile(value: unknown): value is StagedFile {
  const file = value as StagedFile | null;
  return !!file && typeof file.name === "string" && file.blob instanceof Blob;
}

export async function loadStagedFiles(): Promise<File[]> {
  try {
    const stored = await withStore<unknown>("readonly", (s) =>
      s.get(FILES_KEY),
    );
    if (!Array.isArray(stored)) return [];
    return stored.filter(isStagedFile).map(
      (f) =>
        new File([f.blob], f.name, {
          type: f.type,
          lastModified: f.lastModified,
        }),
    );
  } catch {
    return [];
  }
}

// Reading the bytes is async, so saves can finish out of order; only the newest
// one is allowed to write.
let saveSequence = 0;

export async function saveStagedFiles(files: File[]): Promise<void> {
  const sequence = ++saveSequence;
  try {
    if (files.length === 0) {
      await withStore<undefined>("readwrite", (s) => s.delete(FILES_KEY));
      return;
    }
    const staged: StagedFile[] = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        blob: new Blob([await file.arrayBuffer()], { type: file.type }),
      })),
    );
    if (sequence !== saveSequence) return;
    await withStore<IDBValidKey>("readwrite", (s) => s.put(staged, FILES_KEY));
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
