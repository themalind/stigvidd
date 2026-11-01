// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import RoutePreviewMap from "@/components/map/route-preview-map";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { HikingEvent } from "@/data/types";
import { useTrailCoordinates } from "@/hooks/trail/useTrailCoordinates";
import CoordinateParser from "@/utils/coordinate-parser";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { EventStackRoutes } from "./event-routes";
import { useEventMeetingPoint } from "./use-event-meeting-point";

type Props = {
  event: HikingEvent;
  routes: EventStackRoutes;
};

export default function EventMap({ event, routes }: Props) {
  const trailIdentifier = event.trailIdentifier ?? undefined;
  const ownCoordinates = event.route?.kind === "Own" ? event.route.coordinates : undefined;

  const trailCoordinates = useTrailCoordinates(trailIdentifier);

  const json = ownCoordinates ?? trailCoordinates.data?.coordinates;
  const path = useMemo(
    () => (json ? CoordinateParser({ data: json, identifier: event.identifier }) : []),
    [json, event.identifier],
  );

  const meetingPoint = useEventMeetingPoint(event);

  if (path.length === 0 && !meetingPoint) return null;

  const open = () => {
    if (ownCoordinates)
      guardedNavigate(() =>
        router.navigate({ pathname: routes.routeFollow, params: { identifier: event.identifier } }),
      );
    else if (trailIdentifier)
      guardedNavigate(() => router.navigate({ pathname: routes.trailFollow, params: { identifier: trailIdentifier } }));
  };

  return (
    <RoutePreviewMap
      idPrefix="event"
      path={path}
      meetingPoint={meetingPoint}
      onOpen={path.length > 1 ? open : undefined}
      style={s.map}
    />
  );
}

const s = StyleSheet.create({
  map: {
    height: 200,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
});
