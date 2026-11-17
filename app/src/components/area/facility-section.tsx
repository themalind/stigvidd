// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AccessibleTag from "@/components/area/accessible-tag";
import { FacilityIconName } from "@/constants/facility-icons";
import { Facility } from "@/data/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const ICON_SIZE = 20;
const ICON_GAP = 10;

interface FacilitySectionProps {
  label: string;
  icon: FacilityIconName;
  items: Facility[];
}

// A FacilityList row like FacilityCountRow, with the named places listed under its heading. keep-comment: why it mirrors the count row
export default function FacilitySection({ label, icon, items }: FacilitySectionProps) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <View testID={`facility-section-${icon}`} style={s.row}>
      <View style={s.header}>
        <MaterialCommunityIcons name={icon} size={ICON_SIZE} color={theme.colors.primary} />
        <Text style={[s.label, { color: theme.colors.onSurface }]}>{label}</Text>
      </View>
      {items.map((item, index) => (
        <View
          key={item.identifier}
          style={[s.place, index > 0 && [s.divided, { borderTopColor: theme.colors.outlineVariant }]]}
        >
          <Text style={[s.name, { color: theme.colors.onSurface }]}>{item.name}</Text>
          {item.isAccessible && <AccessibleTag testID={`facility-accessible-${item.identifier}`} />}
          {item.location ? (
            <View style={s.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={14} color={theme.colors.onSurfaceVariant} />
              <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]}>{item.location}</Text>
            </View>
          ) : null}
          {item.description ? (
            <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]}>{item.description}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    padding: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ICON_GAP,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  place: {
    paddingLeft: ICON_SIZE + ICON_GAP,
    gap: 4,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: "500",
  },
  meta: {
    fontSize: 13,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
