// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getEventInvitations } from "@/api/events";
import { REQUESTS_STALE_TIME } from "@/constants/cache";
import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import { userAtom } from "./auth-atoms";

export const incomingEventInvitationsAtom = atomWithQuery((get) => {
  const user = get(userAtom);
  return {
    queryKey: ["events", "invitations", user?.id],
    queryFn: () => getEventInvitations(),
    enabled: !!user?.id,
    staleTime: REQUESTS_STALE_TIME,
  };
});

// Clears when an invitation is answered, not when it is seen. keep-comment: like friend requests
export const pendingEventInvitationsCountAtom = atom((get) => {
  return get(incomingEventInvitationsAtom).data?.length ?? 0;
});
