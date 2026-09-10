// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { LiveUserLocation, useLiveUserLocation } from "@/hooks/useLiveUserLocation";
import { MIN_DISTANCE } from "@/services/location-task";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";

jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockLastKnown = jest.fn();
const mockCurrentPosition = jest.fn();
const mockWatchPosition = jest.fn();

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnown(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
  watchPositionAsync: (...args: unknown[]) => mockWatchPosition(...args),
  Accuracy: { Balanced: 3, High: 4, BestForNavigation: 6 },
}));

interface Coords {
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
}

function fix({ latitude = 57.5, longitude = 12.5, accuracy = 8, speed = 0, heading = null }: Coords = {}) {
  return { coords: { latitude, longitude, accuracy, speed, heading }, timestamp: 0 };
}

// The callback expo-location would invoke on every movement update.
let emit: (position: ReturnType<typeof fix>) => void;
let appStateListener: (state: AppStateStatus) => void;
let removeWatcher: jest.Mock;

function render(enabled = true) {
  let live: LiveUserLocation | null = null;
  function Probe() {
    live = useLiveUserLocation(enabled);
    return null;
  }
  const rendered = renderWithProviders(<Probe />);
  return { ...rendered, live: () => live };
}

// Mounted and armed: permission granted, seed applied, watcher installed.
async function renderArmed() {
  const harness = render();
  await flushUntil(() => mockWatchPosition.mock.calls.length > 0);
  await settle();
  return harness;
}

beforeEach(() => {
  jest.clearAllMocks();
  removeWatcher = jest.fn();
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  mockLastKnown.mockResolvedValue(fix());
  mockCurrentPosition.mockResolvedValue(fix());
  mockWatchPosition.mockImplementation(async (_options: unknown, callback: typeof emit) => {
    emit = callback;
    return { remove: removeWatcher };
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_event: string, listener: typeof appStateListener) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("arming", () => {
  it("does nothing at all while disabled", async () => {
    const harness = render(false);
    await settle();

    expect(harness.live()).toBeNull();
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockWatchPosition).not.toHaveBeenCalled();
  });

  // Waiting for the first live update would leave the follow screen without a puck.
  it("seeds the puck from the last known fix", async () => {
    mockLastKnown.mockResolvedValue(fix({ latitude: 57.1, longitude: 12.1, accuracy: 30 }));
    // Held open so the seed is the only position applied at this point.
    mockCurrentPosition.mockImplementation(() => new Promise(() => {}));
    const harness = await renderArmed();

    expect(harness.live()).toEqual({ position: [12.1, 57.1], accuracy: 30, heading: null });
  });

  // The cached seed is often the pre-pocket position, and the watcher is movement-gated,
  // so without this one-shot the puck stays where the phone was put away.
  it("overwrites the seed with a fresh one-shot fix", async () => {
    mockLastKnown.mockResolvedValue(fix({ latitude: 57.1, longitude: 12.1 }));
    mockCurrentPosition.mockResolvedValue(fix({ latitude: 57.9, longitude: 12.9 }));
    const harness = await renderArmed();
    await flushUntil(() => harness.live()?.position[1] === 57.9);

    expect(harness.live()?.position).toEqual([12.9, 57.9]);
    expect(mockCurrentPosition).toHaveBeenCalledWith({ accuracy: 4 });
  });

  it("watches at navigation accuracy, gated on the recorder's minimum distance", async () => {
    await renderArmed();

    expect(mockWatchPosition).toHaveBeenCalledWith(
      { accuracy: 6, distanceInterval: MIN_DISTANCE },
      expect.any(Function),
    );
  });

  it("still shows a puck when there is no cached fix to seed from", async () => {
    mockLastKnown.mockResolvedValue(null);
    mockCurrentPosition.mockResolvedValue(fix({ latitude: 57.9, longitude: 12.9 }));
    const harness = await renderArmed();
    await flushUntil(() => harness.live() !== null);

    expect(harness.live()?.position).toEqual([12.9, 57.9]);
  });

  // A follow screen without a puck is still a usable map of the route.
  it("installs the watcher without waiting for the one-shot fix", async () => {
    mockCurrentPosition.mockImplementation(() => new Promise(() => {}));
    render();
    await flushUntil(() => mockWatchPosition.mock.calls.length > 0);

    expect(mockWatchPosition).toHaveBeenCalledTimes(1);
  });

  it("survives a watcher that refuses to start", async () => {
    mockWatchPosition.mockRejectedValue(new Error("location services off"));
    const harness = render();
    await flushUntil(() => harness.live() !== null);

    expect(harness.live()?.position).toEqual([12.5, 57.5]);
  });

  it("survives a one-shot fix that never lands", async () => {
    mockCurrentPosition.mockRejectedValue(new Error("timeout"));
    const harness = await renderArmed();
    await settle();

    expect(harness.live()?.position).toEqual([12.5, 57.5]);
  });
});

describe("permission", () => {
  it("asks at most once per mount, however often it re-arms", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    render();
    await settle();

    await act(async () => appStateListener("active"));
    await settle();
    await act(async () => appStateListener("active"));
    await settle();

    expect(mockGetPermissions).toHaveBeenCalledTimes(3);
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockWatchPosition).not.toHaveBeenCalled();
  });

  // Asking on Android pauses the activity, and its resume re-arms — an unconditional
  // request here feeds itself and livelocks the screen.
  it("never asks when the system says it cannot ask again", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    render();
    await settle();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockWatchPosition).not.toHaveBeenCalled();
  });

  it("arms when the user accepts at the dialog", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
    await renderArmed();

    expect(mockWatchPosition).toHaveBeenCalledTimes(1);
  });
});

describe("the heading arrow", () => {
  it("stays off at a standstill", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: 0.1, heading: 90 })));

    expect(harness.live()?.heading).toBeNull();
  });

  it("stays off while drifting below a walking pace", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: 0.7, heading: 90 })));

    expect(harness.live()?.heading).toBeNull();
  });

  it("comes on at a deliberate walking pace", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: 0.8, heading: 90 })));

    expect(harness.live()?.heading).toBe(90);
  });

  // The dead band: once walking, ordinary GPS speed noise must not flicker the arrow off.
  it("stays on through the dead band", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: 0.8, heading: 90 })));
    await act(async () => emit(fix({ speed: 0.5, heading: 95 })));

    expect(harness.live()?.heading).toBe(95);
  });

  it("goes off again below the lower threshold", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: 0.8, heading: 90 })));
    await act(async () => emit(fix({ speed: 0.3, heading: 95 })));

    expect(harness.live()?.heading).toBeNull();
  });

  // iOS reports -1 while stationary; Android can report a bogus due north.
  it("ignores a negative course even at walking pace", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: 1.5, heading: -1 })));

    expect(harness.live()?.heading).toBeNull();
  });

  it("ignores a missing course", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: 1.5, heading: null })));

    expect(harness.live()?.heading).toBeNull();
  });

  // A platform that omits speed must read as stopped, not as fast.
  it("treats a missing speed as standing still", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: null, heading: 90 })));

    expect(harness.live()?.heading).toBeNull();
  });

  it("passes an absent accuracy through rather than inventing one", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ accuracy: null })));

    expect(harness.live()?.accuracy).toBeNull();
  });
});

describe("returning to the foreground", () => {
  it("replaces the watcher rather than stacking a second one", async () => {
    await renderArmed();
    await act(async () => appStateListener("active"));
    await flushUntil(() => mockWatchPosition.mock.calls.length > 1);

    expect(removeWatcher).toHaveBeenCalledTimes(1);
    expect(mockWatchPosition).toHaveBeenCalledTimes(2);
  });

  it("leaves the watcher alone when the app merely backgrounds", async () => {
    await renderArmed();
    await act(async () => appStateListener("background"));
    await settle();

    expect(mockWatchPosition).toHaveBeenCalledTimes(1);
    expect(removeWatcher).not.toHaveBeenCalled();
  });

  // Pocketing the phone mid-walk must not drop the arrow, so the hysteresis state has to
  // outlive the re-arm.
  it("keeps the arrow on across a re-arm", async () => {
    const harness = await renderArmed();
    await act(async () => emit(fix({ speed: 1.2, heading: 90 })));

    // The re-arm contributes no fix of its own, so the only thing that can keep the arrow
    // on is the hysteresis state surviving it.
    mockLastKnown.mockResolvedValue(null);
    mockCurrentPosition.mockImplementation(() => new Promise(() => {}));
    await act(async () => appStateListener("active"));
    await flushUntil(() => mockWatchPosition.mock.calls.length > 1);
    await act(async () => emit(fix({ speed: 0.5, heading: 95 })));

    expect(harness.live()?.heading).toBe(95);
  });
});

describe("overlapping arms", () => {
  // A mount arm still awaiting when a foreground arm starts would otherwise install a
  // second native watcher that cleanup never removes, and write its stale fix over the
  // newer one.
  it("discards the watcher of a superseded arm instead of leaking it", async () => {
    let releaseFirstSeed!: () => void;
    mockLastKnown.mockImplementationOnce(
      () => new Promise((resolve) => (releaseFirstSeed = () => resolve(fix({ latitude: 57.1, longitude: 12.1 })))),
    );

    const watchers: { remove: jest.Mock }[] = [];
    mockWatchPosition.mockImplementation(async (_options: unknown, callback: typeof emit) => {
      emit = callback;
      const watcher = { remove: jest.fn() };
      watchers.push(watcher);
      return watcher;
    });

    const harness = render();
    await settle();

    // The foreground arm overtakes the mount arm, which is still waiting on its seed, and
    // installs the watcher that wins.
    await act(async () => appStateListener("active"));
    await flushUntil(() => watchers.length > 0);

    await act(async () => {
      releaseFirstSeed();
    });
    await flushUntil(() => watchers.length > 1);
    await settle();

    // The overtaken arm's watcher is removed on arrival rather than kept alongside.
    expect(watchers[1].remove).toHaveBeenCalledTimes(1);
    expect(watchers[0].remove).not.toHaveBeenCalled();
    // And its seed never reaches the puck.
    expect(harness.live()?.position).toEqual([12.5, 57.5]);
  });

  it("drops a stale fix from a superseded arm", async () => {
    let releaseFirstFresh!: () => void;
    mockCurrentPosition.mockImplementationOnce(
      () => new Promise((resolve) => (releaseFirstFresh = () => resolve(fix({ latitude: 50, longitude: 10 })))),
    );
    mockCurrentPosition.mockResolvedValue(fix({ latitude: 57.9, longitude: 12.9 }));

    const harness = await renderArmed();
    await act(async () => appStateListener("active"));
    await flushUntil(() => harness.live()?.position[1] === 57.9);

    await act(async () => {
      releaseFirstFresh();
    });
    await settle();

    expect(harness.live()?.position).toEqual([12.9, 57.9]);
  });
});

describe("unmounting", () => {
  it("removes the watcher", async () => {
    const harness = await renderArmed();
    harness.unmount();
    await settle();

    expect(removeWatcher).toHaveBeenCalledTimes(1);
  });

  it("stops listening for foreground returns", async () => {
    const removeListener = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_e: string, listener: typeof appStateListener) => {
      appStateListener = listener;
      return { remove: removeListener };
    }) as never);

    const harness = await renderArmed();
    harness.unmount();

    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
