// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getHikeByIdentifier, hikeRouteQueryKey } from "@/api/hikes";
import RouteFollowView from "@/components/map/route-follow-view";
import { HIKE_GEOMETRY_STALE_TIME } from "@/constants/cache";
import CoordinateParser from "@/utils/coordinate-parser";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

// Fullscreen "follow" view for a recorded hike — your own, or one a friend shared with
// you (the API authorises both through the same endpoint). This is what makes a shared
// hike walkable: the friend gets the route plus their own live position.
//
// The route is fetched by identifier rather than handed over through navigation, so the
// screen stands on its own (deep link, cold start). In practice the details modal that
// opens it already holds the geometry and primes this query's cache, so the normal path
// paints immediately without a request.
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
    // Only the coordinates are cached: they're the immutable part of a hike, and both
    // the own-hike and shared-hike payloads carry them in the same shape, so either
    // modal can prime this key.
    queryFn: async () => (await getHikeByIdentifier(hikeIdentifier)).coordinates ?? "",
    enabled: !!hikeIdentifier,
    staleTime: HIKE_GEOMETRY_STALE_TIME,
  });

  const path = useMemo(
    () => (coordinateJson ? CoordinateParser({ data: coordinateJson, identifier: hikeIdentifier }) : []),
    [coordinateJson, hikeIdentifier],
  );

  // Either the request failed, or it succeeded with nothing drawable (empty or
  // unparseable coordinates). Both leave the user on a blank map, so both get the
  // message rather than silence.
  const failed = isError || (!isLoading && coordinateJson !== undefined && path.length === 0);

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
