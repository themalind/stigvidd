// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { EventVisibility } from "@/data/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  visibility: EventVisibility;
};

export default function EventVisibilityChip({ visibility }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isOpen = visibility === "Open";
  const background = isOpen ? theme.colors.primaryContainer : theme.colors.secondaryContainer;
  const color = isOpen ? theme.colors.onPrimaryContainer : theme.colors.onSecondaryContainer;

  return (
    <View style={[s.chip, { backgroundColor: background }]}>
      <MaterialCommunityIcons name={isOpen ? "earth" : "lock-outline"} size={12} color={color} />
      <Text style={[s.label, { color }]}>{isOpen ? t("events.open") : t("events.private")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: BORDER_RADIUS,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
