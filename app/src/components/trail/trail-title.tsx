// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { StyleSheet, Text, View } from "react-native";
import { Icon, useTheme } from "react-native-paper";

interface TrailTitleProps {
  name?: string;
  city?: string;
}

// The trail's name with its city in small muted text underneath.
export default function TrailTitle({ name, city }: TrailTitleProps) {
  const theme = useTheme();
  const place = city?.trim();

  return (
    <View style={s.titles}>
      <Text style={[s.name, { color: theme.colors.onBackground }]}>{name}</Text>
      {!!place && (
        <View testID="trail-title-city" style={s.cityRow}>
          <Icon source="map-marker" size={12} color={theme.colors.onSurfaceVariant} />
          <Text style={[s.city, { color: theme.colors.onSurfaceVariant }]}>{place}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  titles: {
    flexShrink: 1,
    gap: 1,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  city: {
    fontSize: 12,
  },
});
