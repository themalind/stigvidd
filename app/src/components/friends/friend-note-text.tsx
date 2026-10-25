// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface Props {
  note: string;
  size?: "small" | "medium";
}

export default function FriendNoteText({ note, size = "small" }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View testID="friend-note" style={s.row} accessible accessibilityLabel={t("friends.noteAccessibility", { note })}>
      <Icon source="note-text-outline" size={size === "small" ? 13 : 16} color={theme.colors.onSurfaceVariant} />
      <Text
        variant={size === "small" ? "bodySmall" : "bodyMedium"}
        numberOfLines={1}
        style={[s.text, { color: theme.colors.onSurfaceVariant }]}
      >
        {note}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  text: {
    fontStyle: "italic",
    flexShrink: 1,
  },
});
