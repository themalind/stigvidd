// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

type Props = {
  message: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Stands in for content that cannot load offline; React Query fetches it again on reconnect.
export default function OfflineNotice({ message, testID, style }: Props) {
  const theme = useTheme();

  return (
    <View testID={testID} style={[s.container, { backgroundColor: theme.colors.surface }, style]}>
      <MaterialIcons name="cloud-off" size={18} color={theme.colors.onSurfaceVariant} />
      <Text style={[s.text, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  text: {
    flexShrink: 1,
    fontSize: 14,
  },
});
