// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const ICON_SIZE = 16;

export default function FriendsSince({ since }: { since: string }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const color = theme.colors.onSurfaceVariant;
  const date = new Date(since).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });

  return (
    <View testID="friends-since" style={s.row}>
      <View style={s.hikers}>
        <MaterialCommunityIcons name="hiking" size={ICON_SIZE} color={color} />
        <MaterialCommunityIcons name="hiking" size={ICON_SIZE} color={color} style={s.second} />
      </View>
      <Text variant="bodyMedium" style={{ color }}>
        {t("friends.friendsSince", { date })}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hikers: {
    flexDirection: "row",
  },
  second: {
    marginLeft: -6,
  },
});
