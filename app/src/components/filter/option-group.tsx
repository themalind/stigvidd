// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS, SLIM_BUTTON_HEIGHT } from "@/constants/constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface GroupOption<T> {
  value: T;
  label: string;
  testID: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
}

type Props<T> = {
  options: GroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // "fill" shares one row equally; "wrap" sizes each option to its label. keep-comment: two layouts
  layout?: "fill" | "wrap";
};

export default function OptionGroup<T>({ options, value, onChange, layout = "fill" }: Props<T>) {
  const theme = useTheme();

  return (
    <View style={[s.group, layout === "wrap" && s.wrap]}>
      {options.map((option) => {
        const selected = option.value === value;
        const color = selected ? theme.colors.onPrimary : theme.colors.onSurface;
        return (
          <Pressable
            key={option.testID}
            testID={option.testID}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              s.option,
              layout === "fill" && s.fill,
              { backgroundColor: selected ? theme.colors.primary : theme.colors.surface },
            ]}
          >
            {option.icon ? <MaterialCommunityIcons name={option.icon} size={18} color={color} /> : null}
            <Text style={[s.label, { color }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  group: {
    flexDirection: "row",
    gap: 10,
  },
  wrap: {
    flexWrap: "wrap",
  },
  option: {
    flexDirection: "row",
    gap: 5,
    height: SLIM_BUTTON_HEIGHT,
    paddingHorizontal: 15,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  fill: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
});
