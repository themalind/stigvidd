// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userAtom } from "@/atoms/auth-atoms";
import {
  friendsAtom,
  incomingRequestsAtom,
  incomingSharedHikesAtom,
  pendingNotificationsCountAtom,
  userSearchAtomFamily,
} from "@/atoms/friends-atoms";
import { FRIENDS_STALE_TIME } from "@/constants/cache";
import { AuthUser } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { staleTimeOf } from "@/test/query";
import { renderWithProviders } from "@/test/render";
import { Atom, useAtomValue } from "jotai";

const mockGetIncomingRequests = jest.fn();
const mockGetFriends = jest.fn();
const mockSearchUsers = jest.fn();
const mockGetIncomingSharedHikes = jest.fn();

jest.mock("@/api/friends", () => ({
  getIncomingRequests: (...args: unknown[]) => mockGetIncomingRequests(...args),
  getFriends: (...args: unknown[]) => mockGetFriends(...args),
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
}));

jest.mock("@/api/shared-hikes", () => ({
  getIncomingSharedHikes: (...args: unknown[]) => mockGetIncomingSharedHikes(...args),
}));

const USER = { id: "u1" } as AuthUser;

interface QueryResult {
  data?: unknown[];
  isSuccess: boolean;
  isError: boolean;
  fetchStatus: string;
}

// A query atom only fetches once something subscribes to it, so a mounted probe drives it.
function renderQuery(queryAtom: Atom<unknown>, user: AuthUser | null = USER) {
  let result!: QueryResult;
  function Probe() {
    result = useAtomValue(queryAtom as never) as unknown as QueryResult;
    return null;
  }

  const rendered = renderWithProviders(<Probe />, { initialAtoms: [[userAtom, user]] });
  return {
    ...rendered,
    result: () => result,
    settled: () => flushUntil(() => result.isSuccess || result.isError),
  };
}

function renderBadge(user: AuthUser | null = USER) {
  let count = -1;
  function Probe() {
    count = useAtomValue(pendingNotificationsCountAtom);
    return null;
  }

  const rendered = renderWithProviders(<Probe />, { initialAtoms: [[userAtom, user]] });
  return { ...rendered, count: () => count };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIncomingRequests.mockResolvedValue([{ userIdentifier: "u2" }]);
  mockGetFriends.mockResolvedValue([{ userIdentifier: "u3" }]);
  mockGetIncomingSharedHikes.mockResolvedValue([{ hikeIdentifier: "h1" }]);
  mockSearchUsers.mockResolvedValue([{ userIdentifier: "u4" }]);
});

describe("incoming friend requests", () => {
  it("fetches them for a signed-in user", async () => {
    const harness = renderQuery(incomingRequestsAtom);
    await harness.settled();

    expect(harness.result().data).toEqual([{ userIdentifier: "u2" }]);
  });

  // A friend request accepted elsewhere has to disappear on the next visit, so this list is
  // never served from cache.
  it("is never treated as fresh", async () => {
    const harness = renderQuery(incomingRequestsAtom);
    await harness.settled();

    expect(staleTimeOf(harness.queryClient, ["friends", "incoming", "u1"])).toBe(0);
  });

  it("asks for nothing at all while signed out", async () => {
    const harness = renderQuery(incomingRequestsAtom, null);
    await settle();

    expect(mockGetIncomingRequests).not.toHaveBeenCalled();
    expect(harness.result().fetchStatus).toBe("idle");
  });

  // Two accounts on one device must not read each other's requests out of the cache.
  it("keys the cache on the user", async () => {
    const harness = renderQuery(incomingRequestsAtom);
    await harness.settled();

    expect(harness.queryClient.getQueryCache().find({ queryKey: ["friends", "incoming", "u1"] })).toBeDefined();
  });
});

describe("incoming shared hikes", () => {
  it("fetches them for a signed-in user", async () => {
    const harness = renderQuery(incomingSharedHikesAtom);
    await harness.settled();

    expect(harness.result().data).toEqual([{ hikeIdentifier: "h1" }]);
  });

  it("asks for nothing at all while signed out", async () => {
    renderQuery(incomingSharedHikesAtom, null);
    await settle();

    expect(mockGetIncomingSharedHikes).not.toHaveBeenCalled();
  });

  it("is never treated as fresh", async () => {
    const harness = renderQuery(incomingSharedHikesAtom);
    await harness.settled();

    expect(staleTimeOf(harness.queryClient, ["shared-hikes", "incoming", "u1"])).toBe(0);
  });
});

describe("the friends list", () => {
  it("fetches it for a signed-in user", async () => {
    const harness = renderQuery(friendsAtom);
    await harness.settled();

    expect(harness.result().data).toEqual([{ userIdentifier: "u3" }]);
  });

  // Unlike the request lists, a friends list barely changes and keeps.
  it("holds for the shared friends stale time", async () => {
    const harness = renderQuery(friendsAtom);
    await harness.settled();

    expect(staleTimeOf(harness.queryClient, ["friends", "u1"])).toBe(FRIENDS_STALE_TIME);
  });

  it("asks for nothing at all while signed out", async () => {
    renderQuery(friendsAtom, null);
    await settle();

    expect(mockGetFriends).not.toHaveBeenCalled();
  });
});

describe("searching for users", () => {
  // Searching on one or two characters would return most of the user base on every keystroke.
  it.each([
    ["", "empty"],
    ["st", "two characters"],
    ["  s  ", "whitespace around one character"],
  ])("does not search on %s (%s)", async (query) => {
    renderQuery(userSearchAtomFamily(query));
    await settle();

    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it("searches from three characters", async () => {
    const harness = renderQuery(userSearchAtomFamily("sti"));
    await harness.settled();

    expect(mockSearchUsers).toHaveBeenCalledWith("sti");
    expect(harness.result().data).toEqual([{ userIdentifier: "u4" }]);
  });

  it("does not search while signed out", async () => {
    renderQuery(userSearchAtomFamily("stig"), null);
    await settle();

    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  // Two searches must not share a cache entry, or the results of one show under the other.
  it("keys the cache on the search term", async () => {
    const harness = renderQuery(userSearchAtomFamily("stig"));
    await harness.settled();

    expect(harness.queryClient.getQueryCache().find({ queryKey: ["users", "search", "u1", "stig"] })).toBeDefined();
  });
});

describe("the tab-bar badge", () => {
  it("counts both request lists together", async () => {
    mockGetIncomingRequests.mockResolvedValue([{ userIdentifier: "u2" }, { userIdentifier: "u5" }]);
    mockGetIncomingSharedHikes.mockResolvedValue([{ hikeIdentifier: "h1" }]);
    const harness = renderBadge();
    await flushUntil(() => harness.count() === 3);

    expect(harness.count()).toBe(3);
  });

  // Before either list has landed the badge must be absent, not a zero-less guess.
  it("counts nothing while the lists are still loading", () => {
    const harness = renderBadge();

    expect(harness.count()).toBe(0);
  });

  it("counts nothing while signed out", async () => {
    const harness = renderBadge(null);
    await settle();

    expect(harness.count()).toBe(0);
  });

  it("counts shared hikes even with no friend requests", async () => {
    mockGetIncomingRequests.mockResolvedValue([]);
    mockGetIncomingSharedHikes.mockResolvedValue([{ hikeIdentifier: "h1" }, { hikeIdentifier: "h2" }]);
    const harness = renderBadge();
    await flushUntil(() => harness.count() === 2);

    expect(harness.count()).toBe(2);
  });

  it("counts friend requests even with no shared hikes", async () => {
    mockGetIncomingRequests.mockResolvedValue([{ userIdentifier: "u2" }]);
    mockGetIncomingSharedHikes.mockResolvedValue([]);
    const harness = renderBadge();
    await flushUntil(() => harness.count() === 1);

    expect(harness.count()).toBe(1);
  });
});
