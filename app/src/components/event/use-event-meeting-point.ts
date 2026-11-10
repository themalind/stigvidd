// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { HikingEvent } from "@/data/types";
import { MeetingPoint } from "@/utils/map/open-directions";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function useEventMeetingPoint(event: HikingEvent | undefined): MeetingPoint | undefined {
  const { t } = useTranslation();
  const lon = event?.meetingPointLongitude;
  const lat = event?.meetingPointLatitude;
  const name = event?.meetingPointName;

  return useMemo(
    () =>
      lon == null || lat == null
        ? undefined
        : {
            position: [lon, lat],
            label: name ?? t("events.meetingPoint"),
            directionsMessage: t("events.directionsToMeetingPoint"),
          },
    [lon, lat, name, t],
  );
}
