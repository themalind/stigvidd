// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getAreas } from "@/api/areas";
import { CITY_AREAS_STALE_TIME } from "@/constants/cache";
import { useApproximatePosition } from "@/hooks/location/useApproximatePosition";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const areasQueryKey = (latitude?: number, longitude?: number) => ["cityAreas", latitude, longitude] as const;

// keep-comment: nearest first when the user's real position is known
export function useAreas() {
  const { latitude, longitude, hasPosition: positionKnown, isPending: locationPending } = useApproximatePosition();

  const query = useQuery({
    queryKey: areasQueryKey(latitude, longitude),
    queryFn: () => getAreas(latitude, longitude),
    enabled: !locationPending,
    placeholderData: keepPreviousData,
    staleTime: CITY_AREAS_STALE_TIME,
  });

  // keep-comment: from the data shown, so a kept popular list is not labelled nearest while the position's list loads
  const hasPosition = positionKnown && (query.data ?? []).some((area) => area.distanceKm != null);

  return { ...query, hasPosition };
}

export function usePopularAreas(enabled: boolean) {
  return useQuery({
    queryKey: areasQueryKey(),
    queryFn: () => getAreas(),
    enabled,
    staleTime: CITY_AREAS_STALE_TIME,
  });
}
