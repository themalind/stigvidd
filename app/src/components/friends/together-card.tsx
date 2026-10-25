// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { formatDistanceKm } from "@/utils/format-distance";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface ShareTally {
  count: number;
  km: number;
}

interface Props {
  name: string;
  fromFriend: ShareTally;
  fromYou: ShareTally;
}

export default function TogetherCard({ name, fromFriend, fromYou }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (fromFriend.count === 0 && fromYou.count === 0) return null;

  const tile = (testID: string, label: string, tally: ShareTally) => (
    <View testID={testID} style={[s.tile, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text style={s.tileValue}>
        {t("friends.togetherTally", { count: tally.count, km: formatDistanceKm(tally.km) })}
      </Text>
    </View>
  );

  return (
    <View testID="together-card" style={[s.card, { backgroundColor: theme.colors.surface }]}>
      <Text variant="labelLarge" style={[s.heading, { color: theme.colors.onSurfaceVariant }]}>
        {t("friends.together")}
      </Text>
      <View style={s.total}>
        <Text testID="together-total" style={[s.figure, { color: theme.colors.primary }]}>
          {formatDistanceKm(fromFriend.km + fromYou.km)}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t("friends.togetherLabel")}
        </Text>
      </View>
      <View style={s.tiles}>
        {tile("together-from-friend", t("friends.tabFrom", { name }), fromFriend)}
        {tile("together-from-you", t("friends.tabTo"), fromYou)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  heading: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  total: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    columnGap: 8,
  },
  figure: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Inter_600SemiBold",
  },
  tiles: {
    flexDirection: "row",
    gap: 10,
  },
  tile: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tileValue: {
    fontFamily: "Inter_600SemiBold",
  },
});
