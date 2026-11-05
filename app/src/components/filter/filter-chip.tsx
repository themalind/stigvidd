// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS, SLIM_BUTTON_HEIGHT } from "@/constants/constants";
import { Pressable, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
};

export default function FilterChip({ label, selected, onPress, testID }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        s.chip,
        selected
          ? { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary }
          : { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
      ]}
    >
      <Text
        style={[
          s.label,
          { color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface },
          selected && s.selected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: {
    height: SLIM_BUTTON_HEIGHT,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
  },
  selected: {
    fontFamily: "Inter_600SemiBold",
  },
});
