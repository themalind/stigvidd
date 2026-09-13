// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface FacilityCountRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

export default function FacilityCountRow({ icon, label }: FacilityCountRowProps) {
  const theme = useTheme();
  return (
    <View
      testID={`facility-count-${icon}`}
      style={[
        s.row,
        {
          backgroundColor: theme.colors.elevation.level1,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <MaterialIcons name={icon} size={20} color={theme.colors.primary} />
      <Text style={[s.label, { color: theme.colors.onSurface }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    padding: 12,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
