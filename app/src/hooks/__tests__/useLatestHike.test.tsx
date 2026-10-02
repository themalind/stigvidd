// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { HIKES_STALE_TIME } from "@/constants/cache";
import { Hike } from "@/data/types";
import { LatestHikeState, useLatestHike } from "@/hooks/hike/useLatestHike";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { onlineManager } from "@tanstack/react-query";
import { act } from "@testing-library/react-native";

const mockGetAllHikesByUserId = jest.fn();

jest.mock("@/api/hikes", () => ({
  getAllHikesByUserId: (...args: unknown[]) => mockGetAllHikesByUserId(...args),
}));

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

let mockUser: { identifier: string } | undefined;
let mockUserError = false;
const mockRefetchUser = jest.fn();
jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    stigviddUserAtom: atom(() => ({ data: mockUser, isError: mockUserError, refetch: mockRefetchUser })),
  };
});

function hike(identifier: string, createdAt: string): Hike {
  return { identifier, name: `Promenad ${identifier}`, createdAt } as Hike;
}

function render() {
  let state!: LatestHikeState;
  function Probe() {
    state = useLatestHike();
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  return {
    ...rendered,
    settled: () => flushUntil(() => state.kind !== "loading"),
    // A function, not a getter: Babel's object-spread transform snapshots a getter declared
    // in the same literal as a spread, freezing it on the first render.
    state: () => state,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockUser = { identifier: "me" };
  mockUserError = false;
  mockGetAllHikesByUserId.mockResolvedValue([]);
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("useLatestHike", () => {
  // Signed out is decided before the query, so the get-started card renders on the first pass.
  it("reports signed out without waiting for a query", () => {
    mockIsAuthenticated = false;
    const harness = render();

    expect(harness.state()).toEqual({ kind: "signedOut" });
    expect(mockGetAllHikesByUserId).not.toHaveBeenCalled();
  });

  it("reports signed out even before the user has loaded", () => {
    mockIsAuthenticated = false;
    mockUser = undefined;
    const harness = render();

    expect(harness.state()).toEqual({ kind: "signedOut" });
  });

  it("is loading while the hikes are on their way", () => {
    const harness = render();
    expect(harness.state()).toEqual({ kind: "loading" });
  });

  it("stays loading until the user is known", async () => {
    mockUser = undefined;
    const harness = render();
    await flushUntil(() => mockGetAllHikesByUserId.mock.calls.length > 0);

    expect(harness.state()).toEqual({ kind: "loading" });
    expect(mockGetAllHikesByUserId).not.toHaveBeenCalled();
  });

  // Offline the query pauses, so "loading" would hold the skeleton forever.
  it("reports offline instead of loading when there is no connection", async () => {
    onlineManager.setOnline(false);
    mockGetAllHikesByUserId.mockRejectedValue(new TypeError("Network request failed"));
    const harness = render();
    await flushUntil(() => mockGetAllHikesByUserId.mock.calls.length > 0);

    expect(harness.state()).toEqual({ kind: "offline" });
  });

  it("keeps showing the cached walk offline", async () => {
    mockGetAllHikesByUserId.mockResolvedValue([hike("cached", "2026-09-01T10:00:00Z")]);
    const harness = render();
    await harness.settled();

    await act(async () => onlineManager.setOnline(false));

    expect(harness.state()).toMatchObject({ kind: "hike", hike: { identifier: "cached" } });
  });

  it("reports offline while the user is still unknown, too", () => {
    onlineManager.setOnline(false);
    mockUser = undefined;
    const harness = render();

    expect(harness.state()).toEqual({ kind: "offline" });
  });

  it("still reports signed out offline", () => {
    onlineManager.setOnline(false);
    mockIsAuthenticated = false;
    const harness = render();

    expect(harness.state()).toEqual({ kind: "signedOut" });
  });

  it("asks for the signed-in user's hikes", async () => {
    const harness = render();
    await harness.settled();

    expect(mockGetAllHikesByUserId).toHaveBeenCalledWith("me");
  });

  it("reports empty when the user has walked nothing", async () => {
    const harness = render();
    await harness.settled();

    expect(harness.state()).toEqual({ kind: "empty" });
  });

  it("returns the most recent hike", async () => {
    mockGetAllHikesByUserId.mockResolvedValue([
      hike("older", "2026-08-01T10:00:00Z"),
      hike("newest", "2026-09-01T10:00:00Z"),
      hike("middle", "2026-08-20T10:00:00Z"),
    ]);
    const harness = render();
    await harness.settled();

    expect(harness.state()).toMatchObject({ kind: "hike", hike: { identifier: "newest" } });
  });

  // The My hikes screen reads the same key, function and staleTime, so both share one entry.
  it("caches under the key the My hikes screen uses", async () => {
    const harness = render();
    await harness.settled();

    expect(harness.queryClient.getQueryData(["hikes", "me"])).toHaveLength(0);
    expect(harness.queryClient.getQueryDefaults(["hikes", "me"]).staleTime ?? HIKES_STALE_TIME).toBe(HIKES_STALE_TIME);
  });

  it("reports an error the user can retry when the request fails", async () => {
    mockGetAllHikesByUserId.mockRejectedValueOnce(new Error("500"));
    const harness = render();
    await harness.settled();

    const state = harness.state();
    if (state.kind !== "error") throw new Error("expected an error");
    mockGetAllHikesByUserId.mockResolvedValueOnce([hike("later", "2026-09-01T10:00:00Z")]);
    await act(async () => state.retry());
    await flushUntil(() => harness.state().kind === "hike");

    expect(mockGetAllHikesByUserId).toHaveBeenCalledTimes(2);
  });

  // The hikes query waits for the profile, so a failed profile would hold "loading" forever.
  it("reports an error when the profile itself fails", () => {
    mockUser = undefined;
    mockUserError = true;
    const harness = render();

    const state = harness.state();
    if (state.kind !== "error") throw new Error("expected an error");
    state.retry();
    expect(mockRefetchUser).toHaveBeenCalledTimes(1);
  });
});
