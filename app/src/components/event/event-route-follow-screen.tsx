// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import RouteFollowView from "@/components/map/route-follow-view";
import { useEvent } from "@/hooks/events/useEventQueries";
import CoordinateParser from "@/utils/geo/coordinate-parser";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useEventMeetingPoint } from "./use-event-meeting-point";

export default function EventRouteFollowScreen() {
  const { t } = useTranslation();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const { data: event, isLoading, isError } = useEvent(identifier);
  const coordinates = event?.route?.coordinates;
  const meetingPoint = useEventMeetingPoint(event);

  const path = useMemo(
    () => (coordinates && identifier ? CoordinateParser({ data: coordinates, identifier }) : []),
    [coordinates, identifier],
  );

  const failed = !isLoading && path.length === 0 && (isError || event !== undefined);

  return (
    <RouteFollowView
      idPrefix="event-follow"
      path={path}
      title={event?.title}
      isLoading={isLoading}
      errorMessage={failed ? t("map.loadError") : undefined}
      meetingPoint={meetingPoint}
    />
  );
}
