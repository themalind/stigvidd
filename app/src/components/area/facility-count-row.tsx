// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AccessibleTag from "@/components/area/accessible-tag";
import { BORDER_RADIUS } from "@/constants/constants";
import { FacilityIconName } from "@/constants/facility-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface FacilityCountRowProps {
  icon: FacilityIconName;
  label: string;
  accessibleCount?: number;
  // keep-comment: the facilities have no usable names, so the map is where you see which ones are accessible
  onShowAccessible?: () => void;
}

export default function FacilityCountRow({
  icon,
  label,
  accessibleCount = 0,
  onShowAccessible,
}: FacilityCountRowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const linked = accessibleCount > 0 && !!onShowAccessible;

  return (
    <Pressable
      testID={`facility-count-${icon}`}
      disabled={!linked}
      onPress={onShowAccessible}
      accessibilityRole={linked ? "button" : undefined}
      accessibilityHint={linked ? t("area.accessibleOnMap") : undefined}
      style={({ pressed }) => [
        s.row,
        {
          backgroundColor: theme.colors.elevation.level1,
          borderColor: theme.colors.outlineVariant,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={theme.colors.primary} />
      <View style={s.body}>
        <Text style={[s.label, { color: theme.colors.onSurface }]}>{label}</Text>
        {accessibleCount > 0 && <AccessibleTag testID={`facility-count-${icon}-accessible`} count={accessibleCount} />}
      </View>
      {linked && <MaterialCommunityIcons name="map-search-outline" size={20} color={theme.colors.onSurfaceVariant} />}
    </Pressable>
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
  body: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
