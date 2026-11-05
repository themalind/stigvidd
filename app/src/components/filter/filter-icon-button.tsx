// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  activeCount: number;
  label: string;
  onPress: () => void;
  testID?: string;
};

// hitSlop, not padding: a 24 px icon is below the 44 px touch target. keep-comment: why hitSlop
export default function FilterIconButton({ activeCount, label, onPress, testID }: Props) {
  const theme = useTheme();

  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10}>
      <MaterialIcons name="filter-list" size={24} color={theme.colors.onBackground} />
      {activeCount > 0 && (
        <View
          testID={testID ? `${testID}-count` : undefined}
          style={[s.badge, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={[s.badgeText, { color: theme.colors.onPrimary }]}>{activeCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
