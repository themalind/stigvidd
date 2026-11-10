// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CountBadge from "@/components/display/count-badge";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  primary: string;
  secondary?: string;
  badge?: number;
  badgeLabel?: string;
  actionLabel?: string;
  onPress?: () => void;
  testID?: string;
};

export default function EventFactRow({
  icon,
  primary,
  secondary,
  badge,
  badgeLabel,
  actionLabel,
  onPress,
  testID,
}: Props) {
  const theme = useTheme();

  const content = (
    <>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={theme.colors.onSurfaceVariant}
        style={secondary ? s.icon : undefined}
      />
      <View style={s.text}>
        <Text style={[s.primary, { color: theme.colors.onSurface }]}>{primary}</Text>
        {secondary ? <Text style={[s.secondary, { color: theme.colors.onSurfaceVariant }]}>{secondary}</Text> : null}
      </View>
      {badge ? (
        <View style={s.badge}>
          <CountBadge testID={testID ? `${testID}-badge` : undefined} count={badge} accessibilityLabel={badgeLabel} />
        </View>
      ) : null}
      {actionLabel ? <Text style={[s.action, { color: theme.colors.primary }]}>{actionLabel}</Text> : null}
      {onPress ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={actionLabel ? theme.colors.primary : theme.colors.onSurfaceVariant}
          style={s.chevron}
        />
      ) : null}
    </>
  );

  // One line centres in the row's minimum height; two lines keep the icon level with the first. keep-comment: why the alignment depends on secondary
  const rowStyle = [s.row, { alignItems: secondary ? ("flex-start" as const) : ("center" as const) }];

  if (!onPress) {
    return (
      <View testID={testID} style={rowStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={rowStyle}>
      {content}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    minHeight: 44,
  },
  icon: {
    marginTop: 1,
  },
  chevron: {
    alignSelf: "center",
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
  badge: {
    alignSelf: "center",
  },
  action: {
    alignSelf: "center",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
