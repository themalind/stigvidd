// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showDialog } from "@/services/dialog";
import type { TFunction } from "i18next";
import { Linking, Platform } from "react-native";

// A place directions lead to instead of the route's start, such as an event's meeting point. keep-comment: where people gather
export type MeetingPoint = { position: GeoJSON.Position; label: string; directionsMessage: string };

// Hands off to the device's maps app for turn-by-turn directions to a coordinate —
// Apple Maps on iOS, Google Maps elsewhere (both accept the same daddr/destination
// query). Confirms first so an accidental tap doesn't yank the user out of the app.
export function openDirectionsToStart(position: GeoJSON.Position, t: TFunction, message?: string) {
  const [lng, lat] = position;
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  if (!url) return;

  showDialog({
    title: t("map.directionsTitle"),
    message: message ?? t("map.directionsMessage"),
    icon: "directions",
    actions: [
      { label: t("map.directionsConfirm"), onPress: () => Linking.openURL(url).catch(() => undefined) },
      { label: t("common.cancel"), variant: "text" },
    ],
  });
}
