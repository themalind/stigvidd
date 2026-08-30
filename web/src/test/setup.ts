// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Browser APIs jsdom does not implement. These add what is missing rather than
// replacing anything that works, so unlike the Blob swap in staged-media.test.ts
// they are safe to install globally.
//
// Radix drives its Select and Popover from pointer events, and a missing
// hasPointerCapture throws inside React's dispatch — where the error is swallowed
// and the click simply does nothing. The test then fails on the assertion, naming
// the element it could not find rather than the cause.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// A no-op: anything that measures itself through one sees a box of 0 × 0.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let objectUrls = 0;
URL.createObjectURL ??= () => `blob:test/${++objectUrls}`;
URL.revokeObjectURL ??= () => {};

// Every test file gets a fresh document, but storage does not reset with it: a
// leftover refresh token or a staged file would be read by the next test as if
// the code under test had written it.
afterEach(() => {
  cleanup();
  localStorage.clear();
  globalThis.indexedDB = new IDBFactory();
});
