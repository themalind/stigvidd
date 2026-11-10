// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export type TagTone = "primary" | "secondary";

type Props = {
  label: string;
  tone?: TagTone;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  testID?: string;
};

export default function Tag({ label, tone = "primary", icon, testID }: Props) {
  const { colors } = useTheme();
  const palette = {
    primary: { background: colors.primaryContainer, color: colors.onPrimaryContainer },
    secondary: { background: colors.secondaryContainer, color: colors.onSecondaryContainer },
  }[tone];

  return (
    <View testID={testID} style={[s.tag, { backgroundColor: palette.background }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={12} color={palette.color} /> : null}
      <Text style={[s.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: BORDER_RADIUS,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
