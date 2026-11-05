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
  // Sits before the action button, such as a filter icon. keep-comment: where trailing goes
  trailing?: ReactNode;
  action?: Action;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenTitleBar({ title, leading, trailing, action, style }: Props) {
  const theme = useTheme();

  return (
    <View style={[s.row, style]}>
      <View style={s.titleRow}>
        {leading}
        <Text style={[s.title, { color: theme.colors.onBackground }]}>{title}</Text>
      </View>
      <View style={s.end}>
        {trailing}
        {action ? (
          <Pressable testID={action.testID} accessibilityRole="button" onPress={action.onPress}>
            <View style={[s.button, { backgroundColor: theme.colors.primary }]}>
              <MaterialIcons name={action.icon} size={24} color={theme.colors.onPrimary} />
              <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>{action.label}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
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
  end: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
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
