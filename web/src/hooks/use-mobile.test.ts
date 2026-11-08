// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

const listeners = new Set<() => void>();
const originalWidth = window.innerWidth;

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

beforeEach(() => {
  listeners.clear();
  vi.stubGlobal("matchMedia", () => ({
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  setWidth(originalWidth);
});

it("knows the width on the first render", () => {
  setWidth(500);

  expect(renderHook(() => useIsMobile()).result.current).toBe(true);
});

it("follows the window across the breakpoint and stops listening on unmount", () => {
  setWidth(1024);
  const { result, unmount } = renderHook(() => useIsMobile());
  expect(result.current).toBe(false);

  setWidth(767);
  act(() => listeners.forEach((listener) => listener()));
  expect(result.current).toBe(true);

  unmount();
  expect(listeners.size).toBe(0);
});
