// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userAtom } from "@/atoms/auth-atoms";
import { getTrailObstaclesByTrailIdentifier } from "@/api/trail-obstacles";
import { TRAIL_DETAIL_STALE_TIME } from "@/constants/cache";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

// Shared by the details screen and the follow map, so both read one cache entry. keep-comment: why shared
export function useTrailObstacles(identifier: string | undefined) {
  const user = useAtomValue(userAtom);

  return useQuery({
    queryKey: ["obstacles", identifier, user?.id],
    queryFn: () => {
      if (!identifier) throw new Error("expected a trail identifier");
      return getTrailObstaclesByTrailIdentifier(identifier);
    },
    enabled: !!identifier,
    staleTime: TRAIL_DETAIL_STALE_TIME,
    // keep-comment: a sign-in changes the key, and an empty gap would close an open obstacle card; never another trail's
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === identifier ? previous : undefined),
  });
}
