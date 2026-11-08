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
  markEventPostsRead: () => Promise.resolve(),
}));

const BOARD = ["events", "board", "e1", "u1"];
const OTHER_BOARD = ["events", "board", "e2", "u1"];
const FEED = ["events", "feed", "u1"];

async function render() {
  let hook: ReturnType<typeof useEventBoardMutations> | undefined;
  function Probe() {
    hook = useEventBoardMutations("e1");
    return null;
  }

  const rendered = await renderWithProviders(<Probe />);
  // Seeded without an observer, and renderWithProviders sets gcTime 0. keep-comment: why gcTime is raised
  for (const key of [BOARD, OTHER_BOARD, FEED]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, {});
  }

  return {
    queryClient: rendered.queryClient,
    markRead: async () => {
      const current = () => {
        if (!hook) throw new Error("expected the hook to have rendered");
        return hook.markReadMutation;
      };
      await act(() => current().mutate("2026-11-01T10:00:00Z"));
      await flushUntil(() => current().isError || current().isSuccess);
    },
    post: async () => {
      const current = () => {
        if (!hook) throw new Error("expected the hook to have rendered");
        return hook.createPostMutation;
      };
      await act(() => current().mutate("Hej"));
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
    const { post, invalidated } = await render();

    await post();

    expect(invalidated(BOARD)).toBe(true);
    expect(invalidated(OTHER_BOARD)).toBe(false);
    expect(invalidated(FEED)).toBe(false);
  });

  it("clears the unread count on this event's detail once the board is read", async () => {
    const { queryClient, markRead } = await render();
    const detail = ["events", "detail", "e1", "u1"];
    const otherDetail = ["events", "detail", "e2", "u1"];
    for (const key of [detail, otherDetail]) {
      queryClient.setQueryDefaults(key, { gcTime: Infinity });
      queryClient.setQueryData(key, { identifier: key[2], unreadPostCount: 3 });
    }
    queryClient.setQueryData(FEED, { pages: [], pageParams: [] });

    await markRead();

    expect(queryClient.getQueryData(detail)).toEqual({ identifier: "e1", unreadPostCount: 0 });
    expect(queryClient.getQueryData(otherDetail)).toEqual({ identifier: "e2", unreadPostCount: 3 });
  });

  it("refreshes every event query when a post is refused", async () => {
    mockCreatePost.mockRejectedValue(new ApiError("HTTP error", 403, "removed_from_event"));
    const { post, invalidated } = await render();

    await post();

    expect(invalidated(FEED)).toBe(true);
  });
});
