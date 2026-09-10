// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userAtom } from "@/atoms/auth-atoms";
import {
  addToFavoritesAtom,
  addToWishlistAtom,
  removeFromFavoritesAtom,
  removeFromWishlistAtom,
} from "@/atoms/user-atoms";
import { AuthUser, UserFavoritesTrail } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react-native";
import { Atom, useAtom } from "jotai";

const mockAddFavorite = jest.fn();
const mockRemoveFavorite = jest.fn();
const mockAddWishlist = jest.fn();
const mockRemoveWishlist = jest.fn();

jest.mock("@/api/users", () => ({
  getStigViddUser: jest.fn(),
  getUserFavorites: jest.fn(),
  getUserWishlist: jest.fn(),
  addToUserFavorite: (...args: unknown[]) => mockAddFavorite(...args),
  removeUserFavorite: (...args: unknown[]) => mockRemoveFavorite(...args),
  addToUserWishlist: (...args: unknown[]) => mockAddWishlist(...args),
  removeUserWishlist: (...args: unknown[]) => mockRemoveWishlist(...args),
}));

const USER = { id: "u1" } as AuthUser;
const TRAIL = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";
const OTHER = "b7e1a3d2-8c44-4a1f-9f21-5c6d7e8f9a01";

type Mutation = { mutate: (id: string) => void; isPending: boolean; isError: boolean; isSuccess: boolean };

// A mutation atom only runs once something is subscribed to it, so a mounted probe drives it.
// Each of the four atoms has its own result type; only the shared surface above is used here.
function renderMutation(mutationAtom: Atom<unknown>, cache: [unknown[], unknown][] = []) {
  let mutation!: Mutation;
  function Probe() {
    [mutation] = useAtom(mutationAtom as never) as unknown as [Mutation];
    return null;
  }

  const rendered = renderWithProviders(<Probe />, { initialAtoms: [[userAtom, USER]] });
  // renderWithProviders sets gcTime 0, which collects a query the moment it has no observer —
  // and nothing here observes the lists, only the mutations that write to them.
  rendered.queryClient.setQueryDefaults(["userFavorites"], { gcTime: Infinity });
  rendered.queryClient.setQueryDefaults(["userWishlist"], { gcTime: Infinity });
  for (const [key, value] of cache) {
    rendered.queryClient.setQueryData(key, value);
  }
  return {
    ...rendered,
    run: (id: string) => act(() => mutation.mutate(id)),
    // A terminal status: the mutation has not started on the first tick, so it is not pending yet.
    settled: () => flushUntil(() => mutation.isError || mutation.isSuccess),
  };
}

function list(...identifiers: string[]) {
  return identifiers.map((identifier) => ({ identifier }) as UserFavoritesTrail);
}

function favorites(queryClient: QueryClient, uid = "u1") {
  return queryClient.getQueryData<UserFavoritesTrail[]>(["userFavorites", uid]);
}

function wishlist(queryClient: QueryClient, uid = "u1") {
  return queryClient.getQueryData<UserFavoritesTrail[]>(["userWishlist", uid]);
}

// Keeps the request in flight so the optimistic state can be observed before it resolves.
function pending() {
  let settle!: (value?: unknown) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddFavorite.mockResolvedValue(undefined);
  mockRemoveFavorite.mockResolvedValue(undefined);
  mockAddWishlist.mockResolvedValue(undefined);
  mockRemoveWishlist.mockResolvedValue(undefined);
});

describe("addToFavoritesAtom", () => {
  it("calls the endpoint with the trail identifier", async () => {
    const { run } = renderMutation(addToFavoritesAtom, [[["userFavorites", "u1"], list()]]);
    run(TRAIL);
    await settle();

    expect(mockAddFavorite).toHaveBeenCalledWith(TRAIL);
  });

  it("shows the trail as a favourite before the request finishes", async () => {
    const inFlight = pending();
    mockAddFavorite.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(addToFavoritesAtom, [[["userFavorites", "u1"], list(OTHER)]]);

    run(TRAIL);
    await settle();

    expect(favorites(queryClient)).toEqual(list(OTHER, TRAIL));
    await act(async () => inFlight.settle());
  });

  it("does not list the same trail twice", async () => {
    const inFlight = pending();
    mockAddFavorite.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(addToFavoritesAtom, [[["userFavorites", "u1"], list(TRAIL)]]);

    run(TRAIL);
    await settle();

    expect(favorites(queryClient)).toEqual(list(TRAIL));
    await act(async () => inFlight.settle());
  });

  // Writing into a cache the list query has never filled would invent a list of one.
  it("leaves an unfetched list alone", async () => {
    const inFlight = pending();
    mockAddFavorite.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(addToFavoritesAtom);

    run(TRAIL);
    await settle();

    expect(favorites(queryClient)).toBeUndefined();
    await act(async () => inFlight.settle());
  });

  it("puts the old list back when the request fails", async () => {
    mockAddFavorite.mockRejectedValue(new Error("500"));
    const { run, queryClient, settled } = renderMutation(addToFavoritesAtom, [[["userFavorites", "u1"], list(OTHER)]]);

    run(TRAIL);
    await settled();

    expect(favorites(queryClient)).toEqual(list(OTHER));
  });

  it("refetches the list once the request settles", async () => {
    const { run, queryClient } = renderMutation(addToFavoritesAtom, [[["userFavorites", "u1"], list()]]);
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    run(TRAIL);
    await settle();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["userFavorites", "u1"] });
  });

  it("touches only the signed-in user's list", async () => {
    const inFlight = pending();
    mockAddFavorite.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(addToFavoritesAtom, [
      [["userFavorites", "u1"], list()],
      [["userFavorites", "u2"], list(OTHER)],
    ]);

    run(TRAIL);
    await settle();

    expect(favorites(queryClient, "u2")).toEqual(list(OTHER));
    await act(async () => inFlight.settle());
  });
});

describe("addToWishlistAtom", () => {
  it("calls the endpoint with the trail identifier", async () => {
    const { run } = renderMutation(addToWishlistAtom, [[["userWishlist", "u1"], list()]]);
    run(TRAIL);
    await settle();

    expect(mockAddWishlist).toHaveBeenCalledWith(TRAIL);
  });

  it("shows the trail on the list before the request finishes", async () => {
    const inFlight = pending();
    mockAddWishlist.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(addToWishlistAtom, [[["userWishlist", "u1"], list(OTHER)]]);

    run(TRAIL);
    await settle();

    expect(wishlist(queryClient)).toEqual(list(OTHER, TRAIL));
    await act(async () => inFlight.settle());
  });

  it("does not list the same trail twice", async () => {
    const inFlight = pending();
    mockAddWishlist.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(addToWishlistAtom, [[["userWishlist", "u1"], list(TRAIL)]]);

    run(TRAIL);
    await settle();

    expect(wishlist(queryClient)).toEqual(list(TRAIL));
    await act(async () => inFlight.settle());
  });

  it("leaves an unfetched list alone", async () => {
    const inFlight = pending();
    mockAddWishlist.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(addToWishlistAtom);

    run(TRAIL);
    await settle();

    expect(wishlist(queryClient)).toBeUndefined();
    await act(async () => inFlight.settle());
  });

  it("puts the old list back when the request fails", async () => {
    mockAddWishlist.mockRejectedValue(new Error("500"));
    const { run, queryClient, settled } = renderMutation(addToWishlistAtom, [[["userWishlist", "u1"], list(OTHER)]]);

    run(TRAIL);
    await settled();

    expect(wishlist(queryClient)).toEqual(list(OTHER));
  });

  it("refetches the list once the request settles", async () => {
    const { run, queryClient } = renderMutation(addToWishlistAtom, [[["userWishlist", "u1"], list()]]);
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    run(TRAIL);
    await settle();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["userWishlist", "u1"] });
  });
});

describe("removeFromFavoritesAtom", () => {
  it("calls the endpoint with the trail identifier", async () => {
    const { run } = renderMutation(removeFromFavoritesAtom, [[["userFavorites", "u1"], list(TRAIL)]]);
    run(TRAIL);
    await settle();

    expect(mockRemoveFavorite).toHaveBeenCalledWith(TRAIL);
  });

  it("drops the trail before the request finishes", async () => {
    const inFlight = pending();
    mockRemoveFavorite.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(removeFromFavoritesAtom, [
      [["userFavorites", "u1"], list(OTHER, TRAIL)],
    ]);

    run(TRAIL);
    await settle();

    expect(favorites(queryClient)).toEqual(list(OTHER));
    await act(async () => inFlight.settle());
  });

  it("leaves the other trails on the list", async () => {
    const inFlight = pending();
    mockRemoveFavorite.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(removeFromFavoritesAtom, [
      [["userFavorites", "u1"], list(OTHER, TRAIL)],
    ]);

    run(OTHER);
    await settle();

    expect(favorites(queryClient)).toEqual(list(TRAIL));
    await act(async () => inFlight.settle());
  });

  it("puts the removed trail back when the request fails", async () => {
    mockRemoveFavorite.mockRejectedValue(new Error("500"));
    const { run, queryClient, settled } = renderMutation(removeFromFavoritesAtom, [
      [["userFavorites", "u1"], list(OTHER, TRAIL)],
    ]);

    run(TRAIL);
    await settled();

    expect(favorites(queryClient)).toEqual(list(OTHER, TRAIL));
  });

  it("refetches the list once the request settles", async () => {
    const { run, queryClient } = renderMutation(removeFromFavoritesAtom, [[["userFavorites", "u1"], list(TRAIL)]]);
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    run(TRAIL);
    await settle();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["userFavorites", "u1"] });
  });
});

describe("removeFromWishlistAtom", () => {
  it("calls the endpoint with the trail identifier", async () => {
    const { run } = renderMutation(removeFromWishlistAtom, [[["userWishlist", "u1"], list(TRAIL)]]);
    run(TRAIL);
    await settle();

    expect(mockRemoveWishlist).toHaveBeenCalledWith(TRAIL);
  });

  it("drops the trail before the request finishes", async () => {
    const inFlight = pending();
    mockRemoveWishlist.mockReturnValue(inFlight.promise);
    const { run, queryClient } = renderMutation(removeFromWishlistAtom, [[["userWishlist", "u1"], list(OTHER, TRAIL)]]);

    run(TRAIL);
    await settle();

    expect(wishlist(queryClient)).toEqual(list(OTHER));
    await act(async () => inFlight.settle());
  });

  it("puts the removed trail back when the request fails", async () => {
    mockRemoveWishlist.mockRejectedValue(new Error("500"));
    const { run, queryClient, settled } = renderMutation(removeFromWishlistAtom, [
      [["userWishlist", "u1"], list(OTHER, TRAIL)],
    ]);

    run(TRAIL);
    await settled();

    expect(wishlist(queryClient)).toEqual(list(OTHER, TRAIL));
  });

  it("refetches the list once the request settles", async () => {
    const { run, queryClient } = renderMutation(removeFromWishlistAtom, [[["userWishlist", "u1"], list(TRAIL)]]);
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    run(TRAIL);
    await settle();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["userWishlist", "u1"] });
  });
});
