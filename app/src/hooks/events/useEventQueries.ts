// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isApiStatus } from "@/api/api-error";
import { getEvent, getEvents, getMyEvents } from "@/api/events";
import { retryUnlessAuthFailure } from "@/api/unauthorized";
import { userAtom } from "@/atoms/auth-atoms";
import { EVENTS_STALE_TIME } from "@/constants/cache";
import { EventPage } from "@/data/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

function nextCursor(page: EventPage): string | undefined {
  return page.nextCursor ?? undefined;
}

export function useEventFeed() {
  const user = useAtomValue(userAtom);
  return useInfiniteQuery({
    queryKey: ["events", "feed", user?.id],
    queryFn: ({ pageParam }) => getEvents({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
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

export function useMyEvents(past: boolean, enabled = true) {
  const user = useAtomValue(userAtom);
  return useInfiniteQuery({
    queryKey: ["events", "mine", user?.id, past],
    queryFn: ({ pageParam }) => getMyEvents({ past, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
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
