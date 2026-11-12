// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getPopularContributedTrails } from "@/api/trails";
import { POPULAR_TRAILS_STALE_TIME } from "@/constants/cache";
import { useQuery } from "@tanstack/react-query";

export const POPULAR_CONTRIBUTIONS_QUERY_ROOT = ["trails", "popular-contributions"] as const;

export const popularContributionsQueryKey = (latitude?: number, longitude?: number) =>
  [...POPULAR_CONTRIBUTIONS_QUERY_ROOT, latitude, longitude] as const;

// keep-comment: nearby walks when there are any, otherwise the nationwide list
export function usePopularContributions(latitude?: number, longitude?: number, enabled = true) {
  const hasPosition = latitude !== undefined && longitude !== undefined;
  const nearby = useQuery({
    queryKey: popularContributionsQueryKey(latitude, longitude),
    queryFn: () => getPopularContributedTrails(latitude, longitude),
    enabled: enabled && hasPosition,
    staleTime: POPULAR_TRAILS_STALE_TIME,
  });
  const showNearby = hasPosition && (nearby.data?.length ?? 0) > 0;
  const nationwide = useQuery({
    queryKey: popularContributionsQueryKey(),
    queryFn: () => getPopularContributedTrails(),
    enabled: enabled && (!hasPosition || nearby.data?.length === 0),
    staleTime: POPULAR_TRAILS_STALE_TIME,
  });
  return { data: showNearby ? nearby.data : nationwide.data, showNearby };
}
