// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Icon, useTheme } from "react-native-paper";

type Props = {
  count: number;
  size?: "small" | "medium";
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZES = {
  small: { icon: 14, text: 12 },
  medium: { icon: 16, text: 14 },
};

export default function LikeCount({ count, size = "medium", testID, style }: Props) {
  const theme = useTheme();
  const { icon, text } = SIZES[size];

  return (
    <View testID={testID} style={[s.row, style]}>
      <Icon source="thumb-up-outline" size={icon} color={theme.colors.primary} />
      <Text style={[s.count, { color: theme.colors.primary, fontSize: text }]}>{count}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  count: {
    fontFamily: "Inter_600SemiBold",
  },
});
