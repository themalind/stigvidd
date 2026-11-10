// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { dateBadgeParts } from "@/utils/event/event-time";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  startsAt: string;
  muted?: boolean;
};

export default function EventDateBadge({ startsAt, muted = false }: Props) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const { weekday, day, month } = dateBadgeParts(startsAt, i18n.language);
  const background = muted ? theme.colors.secondaryContainer : theme.colors.primaryContainer;
  const color = muted ? theme.colors.onSecondaryContainer : theme.colors.onPrimaryContainer;

  return (
    <View
      style={[s.badge, { backgroundColor: background }]}
      accessible
      accessibilityLabel={`${weekday} ${day} ${month}`}
    >
      <Text style={[s.small, { color }]}>{weekday}</Text>
      <Text style={[s.day, { color }]}>{day}</Text>
      <Text style={[s.small, { color }]}>{month}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    width: 52,
    borderRadius: BORDER_RADIUS,
    paddingVertical: 6,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  small: {
    fontSize: 11,
  },
  day: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 26,
  },
});
