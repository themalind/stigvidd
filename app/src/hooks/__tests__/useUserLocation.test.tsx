// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Every test here holds the permission granted, so the once-per-launch prompt guard is never
// reached; useUserLocation-permission.test.tsx owns that.

import { START_COORDINATE_BORAS } from "@/constants/constants";
import { USER_LOCATION_KEY, useRealUserLocation, useUserLocation } from "@/hooks/useUserLocation";
import { flushUntil, settle } from "@/test/flush";
import { staleTimeOf } from "@/test/query";
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

function position(latitude: number, longitude: number) {
  return { coords: { latitude, longitude, accuracy: 12 }, timestamp: 0 };
}

const LAST_KNOWN = position(57.5, 12.5);
const PRECISE = position(57.6, 12.6);

type Result = ReturnType<typeof useUserLocation>;

function renderHook() {
  let query!: Result;
  let real: ReturnType<typeof useRealUserLocation> = null;
  function Probe() {
    query = useUserLocation();
    real = useRealUserLocation();
    return null;
  }
  const rendered = renderWithProviders(<Probe />);
  return {
    ...rendered,
    query: () => query,
    real: () => real,
    settled: () => flushUntil(() => query.isSuccess || query.isError),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  mockLastKnown.mockResolvedValue(LAST_KNOWN);
  mockCurrentPosition.mockResolvedValue(PRECISE);
});

describe("with a cached fix available", () => {
  // The camera glide and the locate button both wait on this call, so the cached fix is
  // what makes them respond at once instead of after a GPS lock.
  it("answers from the last known position without waiting for a precise fix", async () => {
    const harness = renderHook();
    await harness.settled();

    expect(harness.query().data).toEqual({ latitude: 57.5, longitude: 12.5, isFallback: false });
    expect(mockLastKnown).toHaveBeenCalled();
  });

  it("refines into the cache once the precise fix lands", async () => {
    // A native fix never returns in the same tick as the cached one; resolving it instantly
    // would let react-query write the cached position over the refined one.
    mockCurrentPosition.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(PRECISE), 0)));
    const harness = renderHook();
    await harness.settled();
    await flushUntil(() => harness.query().data?.latitude === 57.6);

    expect(harness.query().data).toEqual({ latitude: 57.6, longitude: 12.6, isFallback: false });
    expect(mockCurrentPosition).toHaveBeenCalledWith({ accuracy: 3 });
  });

  // A failed refine must not turn a position we already have into Borås.
  it("keeps the last known position when the refine fails", async () => {
    let refineSettled = false;
    mockCurrentPosition.mockImplementation(
      () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => {
            refineSettled = true;
            reject(new Error("no fix"));
          }, 0),
        ),
    );
    const harness = renderHook();
    await harness.settled();
    await flushUntil(() => refineSettled);
    await settle();
    await settle();

    expect(harness.query().data).toEqual({ latitude: 57.5, longitude: 12.5, isFallback: false });
  });
});

describe("with no cached fix", () => {
  it("waits for a fresh one", async () => {
    mockLastKnown.mockResolvedValue(null);
    const harness = renderHook();
    await harness.settled();

    expect(harness.query().data).toEqual({ latitude: 57.6, longitude: 12.6, isFallback: false });
    expect(mockCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("falls back to Borås when no fix can be had at all", async () => {
    mockLastKnown.mockResolvedValue(null);
    mockCurrentPosition.mockRejectedValue(new Error("location services off"));
    const harness = renderHook();
    await harness.settled();

    expect(harness.query().data).toEqual({
      latitude: START_COORDINATE_BORAS.latitude,
      longitude: START_COORDINATE_BORAS.longitude,
      isFallback: true,
    });
    // A fallback is a resolved query, not a failed one: the map still needs somewhere to point.
    expect(harness.query().isError).toBe(false);
  });
});

describe("how long an answer keeps", () => {
  it("holds a real fix for ten minutes", async () => {
    const harness = renderHook();
    await harness.settled();

    expect(staleTimeOf(harness.queryClient, USER_LOCATION_KEY)).toBe(600_000);
  });

  // The fallback records only that we could not ask, so the next foreground return has to
  // retry it — that is how a permission granted in Settings ever reaches the app.
  it("holds the Borås fallback for no time at all", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const harness = renderHook();
    await harness.settled();

    expect(staleTimeOf(harness.queryClient, USER_LOCATION_KEY)).toBe(0);
  });
});

describe("useRealUserLocation", () => {
  it("hands back a real fix", async () => {
    const harness = renderHook();
    await harness.settled();

    expect(harness.real()).toEqual({ latitude: 57.5, longitude: 12.5, isFallback: false });
  });

  // Presenting Borås as "you" would put a plausible-looking wrong distance on every card.
  it("hands back nothing when all we have is the fallback", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const harness = renderHook();
    await harness.settled();

    expect(harness.query().data?.isFallback).toBe(true);
    expect(harness.real()).toBeNull();
  });
});
