// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getOutgoingSharedHikes } from "@/api/shared-hikes";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import { SHARED_HIKES_STALE_TIME } from "@/constants/cache";
import { OutgoingSharedHike } from "@/data/types";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

export const outgoingSharesQueryKey = ["shared-hikes", "outgoing"] as const;

export function useOutgoingShares<T = OutgoingSharedHike[]>(select?: (hikes: OutgoingSharedHike[]) => T) {
  const { isAuthenticated } = useAuth();
  const user = useAtomValue(stigviddUserAtom);
  const userIdentifier = user.data?.identifier;

  return useQuery({
    queryKey: [...outgoingSharesQueryKey, userIdentifier],
    queryFn: isAuthenticated && userIdentifier ? () => getOutgoingSharedHikes() : skipToken,
    staleTime: SHARED_HIKES_STALE_TIME,
    select,
  });
}
