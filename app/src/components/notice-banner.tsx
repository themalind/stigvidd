// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  icon: ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  tone?: "error" | "neutral";
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export default function NoticeBanner({ icon, title, tone = "neutral", onPress, style, testID }: Props) {
  const { colors } = useTheme();
  const palette =
    tone === "error"
      ? { background: colors.errorContainer, border: colors.error, color: colors.onErrorContainer }
      : { background: colors.surfaceVariant, border: colors.outline, color: colors.onSurfaceVariant };

  const row = (
    <View style={s.row}>
      <View style={s.label}>
        <MaterialIcons name={icon} size={18} color={palette.color} />
        <Text style={[s.title, { color: palette.color }]}>{title}</Text>
      </View>
      {onPress ? <MaterialIcons name="chevron-right" size={24} color={palette.color} /> : null}
    </View>
  );

  return (
    <View
      testID={testID}
      style={[s.container, { backgroundColor: palette.background, borderLeftColor: palette.border }, style]}
    >
      {onPress ? (
        <Pressable hitSlop={12} accessibilityRole="button" onPress={onPress}>
          {row}
        </Pressable>
      ) : (
        row
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderLeftWidth: 4,
    borderRadius: BORDER_RADIUS,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  label: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontWeight: "700",
  },
});
