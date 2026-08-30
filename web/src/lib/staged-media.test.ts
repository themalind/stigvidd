// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

// A real browser stores a Blob in IndexedDB. fake-indexeddb stores whatever the global
// `structuredClone` gives it, and that is Node's — which does not recognise jsdom's Blob
// and quietly hands back an empty object, so every staged file would be filtered out by
// `isStagedFile`. Node's own Blob and File clone properly.
//
// Scoped to this file on purpose: jsdom's FormData does NOT recognise a Node File either
// and appends it as the string "[object File]", so doing this globally would silently
// break every multipart upload path under test.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;
import {
  loadStagedFiles,
  loadStagedTarget,
  saveStagedFiles,
  saveStagedTarget,
} from "./staged-media";

const TARGET_KEY = "stigvidd:media-upload-target";

function pngFile(name: string, contents: string): File {
  return new File([contents], name, {
    type: "image/png",
    lastModified: 1_700_000_000_000,
  });
}

describe("staged files", () => {
  it("returns nothing when the store is empty", async () => {
    await expect(loadStagedFiles()).resolves.toEqual([]);
  });

  it("round-trips the bytes", async () => {
    await saveStagedFiles([pngFile("hike.png", "the-bytes")]);

    const [restored] = await loadStagedFiles();

    expect(await restored.text()).toBe("the-bytes");
  });

  // The whole point of storing bytes rather than the picked File: after a reload the
  // document can no longer read the file on disk, and an upload built from a stale
  // reference stalls instead of failing. jsdom has no disk-backed File to reproduce
  // that with, so what is asserted is the copy being taken — storing `file` itself
  // round-trips perfectly here and would still be the bug.
  it("reads the bytes at staging time instead of keeping the picked file", async () => {
    const file = pngFile("hike.png", "the-bytes");
    const readBytes = vi.spyOn(file, "arrayBuffer");

    await saveStagedFiles([file]);

    expect(readBytes).toHaveBeenCalled();
  });

  it("keeps the name, type and lastModified the picker gave", async () => {
    await saveStagedFiles([pngFile("hike.png", "x")]);

    const [restored] = await loadStagedFiles();

    expect(restored.name).toBe("hike.png");
    expect(restored.type).toBe("image/png");
    expect(restored.lastModified).toBe(1_700_000_000_000);
  });

  it("keeps several files in the order they were staged", async () => {
    await saveStagedFiles([pngFile("a.png", "a"), pngFile("b.png", "b")]);

    const restored = await loadStagedFiles();

    expect(restored.map((f) => f.name)).toEqual(["a.png", "b.png"]);
  });

  it("clears the store when the last file is removed", async () => {
    await saveStagedFiles([pngFile("a.png", "a")]);

    await saveStagedFiles([]);

    await expect(loadStagedFiles()).resolves.toEqual([]);
  });

  it("replaces the previous staging rather than appending to it", async () => {
    await saveStagedFiles([pngFile("a.png", "a")]);

    await saveStagedFiles([pngFile("b.png", "b")]);

    const restored = await loadStagedFiles();
    expect(restored.map((f) => f.name)).toEqual(["b.png"]);
  });

  // Staging is a convenience; a browser with IndexedDB blocked must still be able
  // to upload, so a failing store has to read as "nothing staged".
  it("reads as empty when IndexedDB is unavailable", async () => {
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    await expect(loadStagedFiles()).resolves.toEqual([]);
  });

  it("swallows a failing save instead of blocking the upload", async () => {
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    await expect(saveStagedFiles([pngFile("a.png", "a")])).resolves.toBeUndefined();
  });

  it("drops an entry that is not a staged file", async () => {
    await saveStagedFiles([pngFile("a.png", "a")]);
    await putRaw(["not a staged file"]);

    await expect(loadStagedFiles()).resolves.toEqual([]);
  });
});

describe("staged target", () => {
  it("returns null when nothing was chosen", () => {
    expect(loadStagedTarget()).toBeNull();
  });

  it("round-trips the chosen target", () => {
    saveStagedTarget({ targetType: "trail", targetId: "abc" });

    expect(loadStagedTarget()).toEqual({ targetType: "trail", targetId: "abc" });
  });

  it("returns null on a target with no type, which names nothing", () => {
    localStorage.setItem(TARGET_KEY, JSON.stringify({ targetId: "abc" }));

    expect(loadStagedTarget()).toBeNull();
  });

  // A target type with no id is real: "trail" before a trail has been picked.
  it("keeps a typed target whose id has not been picked yet", () => {
    localStorage.setItem(TARGET_KEY, JSON.stringify({ targetType: "trail" }));

    expect(loadStagedTarget()).toEqual({ targetType: "trail", targetId: "" });
  });

  it("returns null rather than throwing on a corrupt value", () => {
    localStorage.setItem(TARGET_KEY, "{not json");

    expect(loadStagedTarget()).toBeNull();
  });

  it("swallows a failing write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    expect(() => saveStagedTarget({ targetType: "trail", targetId: "a" })).not.toThrow();
  });
});

/** Writes past the module, to plant something it would never have written itself. */
function putRaw(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("stigvidd-media", 1);
    open.onsuccess = () => {
      const db = open.result;
      const request = db
        .transaction("staged", "readwrite")
        .objectStore("staged")
        .put(value, "files");
      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    };
    open.onerror = () => reject(open.error);
  });
}
