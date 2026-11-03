// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { ComponentProps, ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Action = {
  testID: string;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
  onPress: () => void;
};

type Props = {
  title: string;
  leading?: ReactNode;
  action?: Action;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenTitleBar({ title, leading, action, style }: Props) {
  const theme = useTheme();

  return (
    <View style={[s.row, style]}>
      <View style={s.titleRow}>
        {leading}
        <Text style={[s.title, { color: theme.colors.onBackground }]}>{title}</Text>
      </View>
      {action ? (
        <Pressable testID={action.testID} accessibilityRole="button" onPress={action.onPress}>
          <View style={[s.button, { backgroundColor: theme.colors.primary }]}>
            <MaterialIcons name={action.icon} size={24} color={theme.colors.onPrimary} />
            <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>{action.label}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: 5,
    paddingRight: 10,
    borderRadius: BORDER_RADIUS,
  },
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
