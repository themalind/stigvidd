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

const mockGetAllHikesByUserId = jest.fn();

jest.mock("@/api/hikes", () => ({
  getAllHikesByUserId: (...args: unknown[]) => mockGetAllHikesByUserId(...args),
}));

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

let mockUser: { identifier: string } | undefined;
jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom(() => ({ data: mockUser })) };
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
  mockGetAllHikesByUserId.mockResolvedValue([]);
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

  it("reports empty rather than a hike when the request fails", async () => {
    mockGetAllHikesByUserId.mockRejectedValue(new Error("500"));
    const harness = render();
    await harness.settled();

    expect(harness.state()).toEqual({ kind: "empty" });
  });
});
