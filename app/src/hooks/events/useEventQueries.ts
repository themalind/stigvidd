// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isApiStatus } from "@/api/core/api-error";
import { retryUnlessAuthFailure } from "@/api/core/unauthorized";
import { getEvent, getEvents, getMyEvents } from "@/api/events";
import { userAtom } from "@/atoms/auth-atoms";
import { EVENTS_STALE_TIME } from "@/constants/cache";
import { EventPage, EventSearchParams } from "@/data/types";
import { Query, QueryKey, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

function nextCursor(page: EventPage): string | undefined {
  return page.nextCursor ?? undefined;
}

// Keeps the last list on screen while a changed search loads, but never across a change of user. keep-comment: index 2 of both keys is the user id
function keepWhileSearching(userId: string | undefined) {
  return <T>(previous: T | undefined, previousQuery: Query<T, Error, T, QueryKey> | undefined): T | undefined =>
    previousQuery?.queryKey[2] === userId ? previous : undefined;
}

export function useEventFeed(search: EventSearchParams = {}) {
  const user = useAtomValue(userAtom);
  return useInfiniteQuery({
    queryKey: ["events", "feed", user?.id, search],
    queryFn: ({ pageParam }) => getEvents({ ...search, cursor: pageParam, excludeMine: true }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepWhileSearching(user?.id),
    staleTime: EVENTS_STALE_TIME,
  });
}

// The first page of upcoming open events a user arranges, for their profile. keep-comment: only open ones, the server hides private
export function useOrganizerEvents(organizerIdentifier: string | undefined) {
  const user = useAtomValue(userAtom);
  return useQuery({
    queryKey: ["events", "organizer", organizerIdentifier, user?.id],
    queryFn: () => getEvents({ organizer: organizerIdentifier }),
    select: (page) => page.items,
    enabled: !!user?.id && !!organizerIdentifier,
    staleTime: EVENTS_STALE_TIME,
  });
}

export function useMyEvents(past: boolean, enabled = true, search: EventSearchParams = {}) {
  const user = useAtomValue(userAtom);
  return useInfiniteQuery({
    queryKey: ["events", "mine", user?.id, past, search],
    queryFn: ({ pageParam }) => getMyEvents({ ...search, past, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepWhileSearching(user?.id),
    enabled: enabled && !!user?.id,
    staleTime: EVENTS_STALE_TIME,
  });
}

export function useEvent(identifier: string | undefined) {
  const user = useAtomValue(userAtom);
  return useQuery({
    queryKey: ["events", "detail", identifier, user?.id],
    queryFn: () => {
      if (!identifier) throw new Error("expected an event identifier");
      return getEvent(identifier);
    },
    enabled: !!identifier,
    staleTime: EVENTS_STALE_TIME,
    retry: (failureCount, error) => !isApiStatus(error, 404) && retryUnlessAuthFailure(failureCount, error),
  });
}
