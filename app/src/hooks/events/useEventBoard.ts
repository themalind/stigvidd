// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isApiStatus } from "@/api/api-error";
import {
  createEventPost,
  deleteEventPost,
  getEventPosts,
  markEventPostsRead,
  setEventMuted,
  setEventPostPinned,
  updateEventPost,
} from "@/api/events";
import { retryUnlessAuthFailure } from "@/api/unauthorized";
import { userAtom } from "@/atoms/auth-atoms";
import { EVENT_BOARD_STALE_TIME } from "@/constants/cache";
import { EventBoard, EventPage, EventPost } from "@/data/types";
import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useEventErrorHandler } from "./useEventErrorHandler";

export function eventBoardKey(identifier: string | undefined) {
  return ["events", "board", identifier];
}

export function useEventBoard(identifier: string | undefined) {
  const user = useAtomValue(userAtom);
  const query = useInfiniteQuery({
    queryKey: [...eventBoardKey(identifier), user?.id],
    queryFn: ({ pageParam }) => {
      if (!identifier) throw new Error("expected an event identifier");
      return getEventPosts(identifier, pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !!user?.id && !!identifier,
    staleTime: EVENT_BOARD_STALE_TIME,
    retry: (failureCount, error) =>
      !isApiStatus(error, 404) && !isApiStatus(error, 403) && retryUnlessAuthFailure(failureCount, error),
  });

  const first = query.data?.pages[0];
  // Newest first, for the inverted list: each page is oldest first and later pages are older. keep-comment: the cursor pages backwards
  const posts = useMemo<EventPost[]>(
    () => (query.data ? query.data.pages.flatMap((page) => [...page.posts].reverse()) : []),
    [query.data],
  );

  return {
    ...query,
    posts,
    pinned: first?.pinned ?? [],
    muted: first?.muted ?? false,
    lastReadPostAt: first?.lastReadPostAt ?? null,
  };
}

// The oldest post after the read marker, not counting the user's own; posts are newest first. keep-comment: where the "new posts" divider goes
export function firstUnreadPostId(posts: EventPost[], lastReadPostAt: string | null): string | undefined {
  const readUpTo = lastReadPostAt === null ? Number.NEGATIVE_INFINITY : Date.parse(lastReadPostAt);
  for (let i = posts.length - 1; i >= 0; i--) {
    if (!posts[i].isMine && Date.parse(posts[i].createdAt) > readUpTo) return posts[i].identifier;
  }
  return undefined;
}

type BoardData = InfiniteData<EventBoard, string | undefined>;

function mapPosts(data: BoardData, map: (posts: EventPost[]) => EventPost[]): BoardData {
  return { ...data, pages: data.pages.map((page) => ({ ...page, pinned: map(page.pinned), posts: map(page.posts) })) };
}

export function useEventBoardMutations(identifier: string) {
  const queryClient = useQueryClient();
  const { onEventError } = useEventErrorHandler();
  // A new post or a pin refetches this board, as others may have posted meanwhile. keep-comment: errors still refresh every event query
  const refreshBoard = () => void queryClient.invalidateQueries({ queryKey: eventBoardKey(identifier) });
  // An edit, delete or mute is written into the loaded pages, so no page is fetched again. keep-comment: a refetch reloads every page scrolled back to
  const patchBoard = (patch: (data: BoardData) => BoardData) =>
    queryClient.setQueriesData<BoardData>({ queryKey: eventBoardKey(identifier) }, (data) =>
      data ? patch(data) : data,
    );

  const createPostMutation = useMutation({
    mutationFn: (body: string) => createEventPost(identifier, body),
    onSuccess: refreshBoard,
    onError: (error) => onEventError(error),
  });

  const editPostMutation = useMutation({
    mutationFn: ({ postIdentifier, body }: { postIdentifier: string; body: string }) =>
      updateEventPost(postIdentifier, body),
    onSuccess: (edited) =>
      patchBoard((data) =>
        mapPosts(data, (posts) => posts.map((post) => (post.identifier === edited.identifier ? edited : post))),
      ),
    onError: (error) => onEventError(error),
  });

  const deletePostMutation = useMutation({
    mutationFn: (postIdentifier: string) => deleteEventPost(postIdentifier),
    onSuccess: (_data, deleted) =>
      patchBoard((data) => mapPosts(data, (posts) => posts.filter((post) => post.identifier !== deleted))),
    onError: (error) => onEventError(error),
  });

  const pinMutation = useMutation({
    mutationFn: ({ postIdentifier, pinned }: { postIdentifier: string; pinned: boolean }) =>
      setEventPostPinned(postIdentifier, pinned),
    onSuccess: refreshBoard,
    onError: (error) => onEventError(error),
  });

  const muteMutation = useMutation({
    mutationFn: (muted: boolean) => setEventMuted(identifier, muted),
    onSuccess: (_data, muted) =>
      patchBoard((data) => ({ ...data, pages: data.pages.map((page) => ({ ...page, muted })) })),
    onError: (error) => onEventError(error),
  });

  // Silent: a failed read marker only leaves the badge lit until the next visit. keep-comment: why errors are not shown
  const markReadMutation = useMutation({
    mutationFn: (readUpTo: string) => markEventPostsRead(identifier, readUpTo),
    // Everything up to the newest post is read, so the event's cards drop their unread count. keep-comment: patched, not refetched
    onSuccess: () => {
      const clearUnread = (data: InfiniteData<EventPage> | undefined) =>
        data && {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.identifier === identifier ? { ...item, unreadPostCount: 0 } : item)),
          })),
        };
      queryClient.setQueriesData<InfiniteData<EventPage>>({ queryKey: ["events", "mine"] }, clearUnread);
      queryClient.setQueriesData<InfiniteData<EventPage>>({ queryKey: ["events", "feed"] }, clearUnread);
    },
  });

  return { createPostMutation, editPostMutation, deletePostMutation, pinMutation, muteMutation, markReadMutation };
}
