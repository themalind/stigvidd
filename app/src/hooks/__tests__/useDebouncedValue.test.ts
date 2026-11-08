// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { act, renderHook } from "@testing-library/react-native";
import { useDebouncedValue } from "../useDebouncedValue";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("starts with the first value", async () => {
    const { result } = await renderHook(() => useDebouncedValue("kype", 300));
    expect(result.current).toBe("kype");
  });

  it("keeps the old value until the new one has held still for the delay", async () => {
    const { result, rerender } = await renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    });

    await rerender({ value: "k" });
    await act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe("");

    await act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("k");
  });

  it("restarts the wait on every change and settles on the last value", async () => {
    const { result, rerender } = await renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    });

    await rerender({ value: "k" });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    await rerender({ value: "ky" });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe("");

    await act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("ky");
  });
});
