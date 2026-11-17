// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AccessibleTag from "@/components/area/accessible-tag";
import { FacilityIconName } from "@/constants/facility-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// keep-comment: shared with FacilitySection, whose rows sit on the same FacilityList and must line up with these
export const FACILITY_ICON_SIZE = 20;
export const FACILITY_ICON_GAP = 10;
export const FACILITY_ROW_PADDING = 12;

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
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={FACILITY_ICON_SIZE} color={theme.colors.primary} />
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
    gap: FACILITY_ICON_GAP,
    padding: FACILITY_ROW_PADDING,
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
