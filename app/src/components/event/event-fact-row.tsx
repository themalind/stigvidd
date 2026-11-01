// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  primary: string;
  secondary?: string;
  onPress?: () => void;
  testID?: string;
};

export default function EventFactRow({ icon, primary, secondary, onPress, testID }: Props) {
  const theme = useTheme();

  const content = (
    <>
      <MaterialCommunityIcons name={icon} size={20} color={theme.colors.onSurfaceVariant} style={s.icon} />
      <View style={s.text}>
        <Text style={[s.primary, { color: theme.colors.onSurface }]}>{primary}</Text>
        {secondary ? <Text style={[s.secondary, { color: theme.colors.onSurfaceVariant }]}>{secondary}</Text> : null}
      </View>
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={s.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={s.row}>
      {content}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 44,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  primary: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  secondary: {
    fontSize: 13,
  },
});
