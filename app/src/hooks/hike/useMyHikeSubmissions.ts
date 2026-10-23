// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getMyHikeSubmissions } from "@/api/hike-submissions";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import { HIKES_STALE_TIME } from "@/constants/cache";
import { HikeSubmission } from "@/data/types";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

export const HIKE_SUBMISSIONS_QUERY_ROOT = "hikeSubmissions";

export const myHikeSubmissionsQueryKey = (userIdentifier: string | undefined) =>
  [HIKE_SUBMISSIONS_QUERY_ROOT, userIdentifier] as const;

export function useMyHikeSubmissions<T = HikeSubmission[]>(select?: (submissions: HikeSubmission[]) => T) {
  const { isAuthenticated } = useAuth();
  const user = useAtomValue(stigviddUserAtom);
  const userIdentifier = user.data?.identifier;

  return useQuery({
    queryKey: myHikeSubmissionsQueryKey(userIdentifier),
    queryFn: isAuthenticated && userIdentifier ? () => getMyHikeSubmissions() : skipToken,
    staleTime: HIKES_STALE_TIME,
    // keep-comment: an admin decides on submissions in the background, so each screen visit asks again
    refetchOnMount: "always",
    select,
  });
}
