// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// "Prompt at most once" is tracked in module scope, and a Jest module registry is per file,
// so this file is one app launch — the launch in which the user refuses at the dialog.
// The tests run in order by design: each is a later moment in that launch, and the guard is
// only observable as the difference between them. The launch in which the user accepts is
// useUserLocation-permission-granted.test.tsx. See docs/notes/android-permission-dialog-loop.md.

import { USER_LOCATION_KEY, useUserLocation } from "@/hooks/useUserLocation";
import { flushUntil } from "@/test/flush";
import { act } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/render";

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockLastKnown = jest.fn();
const mockCurrentPosition = jest.fn();

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnown(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
  Accuracy: { Balanced: 3, High: 4, BestForNavigation: 6 },
}));

const FIX = { coords: { latitude: 57.5, longitude: 12.5, accuracy: 12 }, timestamp: 0 };

type Result = ReturnType<typeof useUserLocation>;

function renderHook() {
  let query!: Result;
  function Probe() {
    query = useUserLocation();
    return null;
  }
  const rendered = renderWithProviders(<Probe />);
  return {
    ...rendered,
    query: () => query,
    settled: () => flushUntil(() => query.isSuccess || query.isError),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLastKnown.mockResolvedValue(FIX);
  mockCurrentPosition.mockResolvedValue(FIX);
});

describe("before the dialog has ever been shown", () => {
  // Asking anyway would burn the one prompt this launch gets on a user who has already
  // refused permanently.
  it("does not ask when the system says it cannot ask again", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const harness = renderHook();
    await harness.settled();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(harness.query().data?.isFallback).toBe(true);
  });
});

describe("the first time the app has to ask", () => {
  it("shows the dialog and takes the answer the user gives", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const harness = renderHook();
    await harness.settled();

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(harness.query().data?.isFallback).toBe(true);
    expect(mockLastKnown).not.toHaveBeenCalled();
  });
});

describe("every later refetch in the same launch", () => {
  // The query refetches on every foreground return, and asking on Android backgrounds the
  // app — so asking again here would re-trigger the very focus event that got us here, and
  // the dialog would loop until the user force-quits.
  it("never shows the dialog a second time", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const harness = renderHook();
    await harness.settled();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(harness.query().data?.isFallback).toBe(true);
  });

  it("still refetches rather than staying on the fallback", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const harness = renderHook();
    await harness.settled();

    // Granted in Settings while the app was away: the status check picks it up.
    mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
    await act(async () => {
      await harness.queryClient.refetchQueries({ queryKey: USER_LOCATION_KEY });
    });
    await flushUntil(() => harness.query().data?.isFallback === false);

    expect(harness.query().data).toEqual({ latitude: 57.5, longitude: 12.5, isFallback: false });
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });
});
