// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  testID: string;
  style?: StyleProp<ViewStyle>;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[s.container, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }, style]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={`${testID}-${option.value}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[s.segment, selected && { backgroundColor: theme.colors.secondary }]}
          >
            <Text style={[s.label, { color: selected ? theme.colors.onSecondary : theme.colors.onSurface }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
