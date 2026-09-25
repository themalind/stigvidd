// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { useBlockMutations } from "@/hooks/friends/useBlockMutations";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockBlock = jest.fn();
const mockUnblock = jest.fn();

jest.mock("@/api/friends", () => ({
  blockUser: (...args: unknown[]) => mockBlock(...args),
  unblockUser: (...args: unknown[]) => mockUnblock(...args),
}));

const FRIENDS = ["friends", "u1"];
const BLOCKS = ["blocks"];
const REVIEWS = ["reviews", "trail-1"];
const OBSTACLES = ["obstacles", "trail-1"];
const SHARED_HIKES = ["shared-hikes", "u1"];
const SEARCH = ["users", "search", "u1", "grima"];

type Mutations = ReturnType<typeof useBlockMutations>;
type MutationName = keyof Mutations;

function render() {
  let hook: Mutations | undefined;
  function Probe() {
    hook = useBlockMutations();
    return null;
  }

  function mutation(name: MutationName) {
    if (!hook) throw new Error("expected the probe to have rendered");
    return hook[name];
  }

  const rendered = renderWithProviders(<Probe />);
  // The lists are seeded without an observer, and renderWithProviders sets gcTime 0.
  for (const key of [FRIENDS, BLOCKS, REVIEWS, OBSTACLES, SHARED_HIKES, SEARCH]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, []);
  }

  return {
    ...rendered,
    run: async (name: MutationName, arg: string) => {
      act(() => mutation(name).mutate(arg));
      await flushUntil(() => mutation(name).isError || mutation(name).isSuccess);
    },
    invalidated: (key: unknown[]) => rendered.queryClient.getQueryState(key)?.isInvalidated === true,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBlock.mockResolvedValue({ success: true });
  mockUnblock.mockResolvedValue({ success: true });
});

describe("blocking", () => {
  it("blocks the person it was given", async () => {
    const { run } = render();
    await run("blockMutation", "them");

    expect(mockBlock).toHaveBeenCalledWith("them");
  });

  // The block filters seven of the blocker's reads; each one has to be re-read to apply it.
  it("refreshes every list that can carry the blocked person", async () => {
    const { run, invalidated } = render();
    await run("blockMutation", "them");

    expect(invalidated(FRIENDS)).toBe(true);
    expect(invalidated(BLOCKS)).toBe(true);
    expect(invalidated(REVIEWS)).toBe(true);
    expect(invalidated(OBSTACLES)).toBe(true);
    expect(invalidated(SHARED_HIKES)).toBe(true);
    expect(invalidated(SEARCH)).toBe(true);
  });

  it("confirms the block", async () => {
    const { run, store } = render();
    await run("blockMutation", "them");

    expect(store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "success",
      message: "Användaren är blockerad",
    });
  });

  it("says so when the block fails", async () => {
    mockBlock.mockRejectedValue(new Error("nope"));
    const { run, store } = render();
    await run("blockMutation", "them");

    expect(store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "error",
    });
  });
});

describe("unblocking", () => {
  it("unblocks the person it was given", async () => {
    const { run } = render();
    await run("unblockMutation", "them");

    expect(mockUnblock).toHaveBeenCalledWith("them");
  });

  // Their content comes back, so the same lists go stale again.
  it("refreshes the same lists the block touched", async () => {
    const { run, invalidated } = render();
    await run("unblockMutation", "them");

    expect(invalidated(BLOCKS)).toBe(true);
    expect(invalidated(REVIEWS)).toBe(true);
    expect(invalidated(OBSTACLES)).toBe(true);
    expect(invalidated(SHARED_HIKES)).toBe(true);
    expect(invalidated(SEARCH)).toBe(true);
  });

  it("says so when the unblock fails", async () => {
    mockUnblock.mockRejectedValue(new Error("nope"));
    const { run, store } = render();
    await run("unblockMutation", "them");

    expect(store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "error",
    });
  });
});
