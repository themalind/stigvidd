// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export default function assertUsableLocalStorage() {
  if ("localStorage" in globalThis && globalThis.localStorage === undefined)
    throw new Error(
      `Node ${process.versions.node} defines an undefined global localStorage that shadows jsdom's, ` +
        "so every test would fail in setup. Use Node 24 — see docs/notes/node-26-shadows-jsdom-localstorage.md",
    );
}
