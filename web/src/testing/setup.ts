// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// keep-comment: Jenkins runs three suites at once; a cold first render passed 1 s there (facilities.test.tsx)
configure({ asyncUtilTimeout: 5000 });

// keep-comment: without these, a Radix Select/Popover click silently does nothing in jsdom
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// keep-comment: storage outlives the document, so a leftover token would leak into the next test
afterEach(() => {
  cleanup();
  localStorage.clear();
  globalThis.indexedDB = new IDBFactory();
});
