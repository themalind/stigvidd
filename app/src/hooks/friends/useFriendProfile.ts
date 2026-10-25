// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getFriendProfile } from "@/api/friends";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import { FRIENDS_STALE_TIME } from "@/constants/cache";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

export function useFriendProfile(friendIdentifier: string | undefined) {
  const { isAuthenticated } = useAuth();
  const user = useAtomValue(stigviddUserAtom);
  const userIdentifier = user.data?.identifier;

  return useQuery({
    queryKey: ["friends", "profile", userIdentifier, friendIdentifier],
    queryFn:
      isAuthenticated && userIdentifier && friendIdentifier ? () => getFriendProfile(friendIdentifier) : skipToken,
    staleTime: FRIENDS_STALE_TIME,
  });
}
