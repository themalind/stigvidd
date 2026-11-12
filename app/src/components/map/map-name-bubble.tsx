// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { Marker } from "@maplibre/maplibre-react-native";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  name: string;
  coordinates: [number, number];
}

// keep-comment: facilities have no page of their own, so a tapped pin shows its name above it
export default function MapNameBubble({ name, coordinates }: Props) {
  const theme = useTheme();

  return (
    <Marker lngLat={coordinates} anchor="bottom" offset={[0, -8]}>
      <View testID="map-name-bubble" style={[s.callout, { backgroundColor: theme.colors.elevation.level3 }]}>
        <Text style={[s.calloutText, { color: theme.colors.onSurface }]} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Marker>
  );
}

const s = StyleSheet.create({
  callout: {
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS,
  },
  calloutText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
