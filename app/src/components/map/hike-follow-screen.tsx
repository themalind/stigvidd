// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getHikeByIdentifier, hikeRouteQueryKey } from "@/api/hikes";
import RouteFollowView from "@/components/map/route-follow-view";
import { HIKE_GEOMETRY_STALE_TIME } from "@/constants/cache";
import CoordinateParser from "@/utils/geo/coordinate-parser";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

// keep-comment: own and shared hikes both come through one endpoint, which authorises either
// keep-comment: fetched by id so a deep link works; the details screen primes this cache first
export default function HikeFollowScreen() {
  const { t } = useTranslation();
  const { identifier, name } = useLocalSearchParams<{ identifier: string; name?: string }>();
  const hikeIdentifier: string = Array.isArray(identifier) ? identifier[0] : identifier;
  const hikeName: string | undefined = Array.isArray(name) ? name[0] : name;

  const {
    data: coordinateJson,
    isLoading,
    isError,
  } = useQuery({
    queryKey: hikeRouteQueryKey(hikeIdentifier),
    // keep-comment: only coordinates, the part that never changes and that both payloads share
    queryFn: async () => (await getHikeByIdentifier(hikeIdentifier)).coordinates ?? "",
    enabled: !!hikeIdentifier,
    staleTime: HIKE_GEOMETRY_STALE_TIME,
  });

  const path = useMemo(
    () => (coordinateJson ? CoordinateParser({ data: coordinateJson, identifier: hikeIdentifier }) : []),
    [coordinateJson, hikeIdentifier],
  );

  // Only when there is nothing to draw: a failed refetch keeps the route already shown. keep-comment: refetch-error semantics
  const failed = !isLoading && path.length === 0 && (isError || coordinateJson !== undefined);

  return (
    <RouteFollowView
      idPrefix="hike-follow"
      path={path}
      title={hikeName}
      isLoading={isLoading}
      errorMessage={failed ? t("map.loadError") : undefined}
    />
  );
}
