// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { useEventBoardMutations } from "@/hooks/events/useEventBoard";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockCreatePost = jest.fn();

jest.mock("@/api/events", () => ({
  createEventPost: (...args: unknown[]) => mockCreatePost(...args),
}));

const BOARD = ["events", "board", "e1", "u1"];
const OTHER_BOARD = ["events", "board", "e2", "u1"];
const FEED = ["events", "feed", "u1"];

function render() {
  let hook: ReturnType<typeof useEventBoardMutations> | undefined;
  function Probe() {
    hook = useEventBoardMutations("e1");
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  // Seeded without an observer, and renderWithProviders sets gcTime 0. keep-comment: why gcTime is raised
  for (const key of [BOARD, OTHER_BOARD, FEED]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, {});
  }

  return {
    post: async () => {
      const current = () => {
        if (!hook) throw new Error("expected the hook to have rendered");
        return hook.createPostMutation;
      };
      act(() => current().mutate("Hej"));
      await flushUntil(() => current().isError || current().isSuccess);
    },
    invalidated: (key: unknown[]) => rendered.queryClient.getQueryState(key)?.isInvalidated === true,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useEventBoardMutations", () => {
  it("refetches only this board after a post", async () => {
    mockCreatePost.mockResolvedValue({});
    const { post, invalidated } = render();

    await post();

    expect(invalidated(BOARD)).toBe(true);
    expect(invalidated(OTHER_BOARD)).toBe(false);
    expect(invalidated(FEED)).toBe(false);
  });

  it("refreshes every event query when a post is refused", async () => {
    mockCreatePost.mockRejectedValue(new ApiError("HTTP error", 403, "removed_from_event"));
    const { post, invalidated } = render();

    await post();

    expect(invalidated(FEED)).toBe(true);
  });
});
