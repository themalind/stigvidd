// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FriendNoteText from "@/components/friends/friend-note-text";
import UserAvatar, { AVATAR_SIZE } from "@/components/friends/user-avatar";
import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

const ROW_PADDING = 16;
const ROW_GAP = 14;

interface Props {
  name: string;
  identifier: string;
  note?: string | null;
  subtitle?: string;
  subtitleTone?: "muted" | "accent";
  onPress?: () => void;
  trailing?: ReactNode;
  actions?: ReactNode;
  testID?: string;
}

export default function PersonRow({
  name,
  identifier,
  note,
  subtitle,
  subtitleTone = "muted",
  onPress,
  trailing,
  actions,
  testID,
}: Props) {
  const theme = useTheme();
  const subtitleColor = subtitleTone === "accent" ? theme.colors.primary : theme.colors.onSurfaceVariant;

  const body = (
    <View style={s.row}>
      <UserAvatar name={name} seed={identifier} />
      <View style={s.text}>
        <View style={s.nameLine}>
          <Text variant="bodyLarge" numberOfLines={1} style={s.name}>
            {name}
          </Text>
          {!!note && <FriendNoteText note={note} />}
        </View>
        {!!subtitle && (
          <Text variant="bodySmall" numberOfLines={1} style={{ color: subtitleColor }}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {onPress && <Icon source="chevron-right" size={20} color={theme.colors.outline} />}
    </View>
  );

  return (
    <View testID={testID}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name}
          onPress={onPress}
          style={({ pressed }) => pressed && s.pressed}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {actions && <View style={s.actions}>{actions}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ROW_PADDING,
    paddingVertical: 10,
    gap: ROW_GAP,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontWeight: "500",
    flexShrink: 0,
    maxWidth: "60%",
  },
  pressed: {
    opacity: 0.7,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingLeft: ROW_PADDING + AVATAR_SIZE + ROW_GAP,
    paddingRight: ROW_PADDING,
    paddingBottom: 12,
  },
});
