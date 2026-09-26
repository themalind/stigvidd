// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BanContactText from "@/components/auth/ban-contact-text";
import { BORDER_RADIUS } from "@/constants/constants";
import { formatDate } from "@/utils/format-date";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  bannedAt: string;
}

export default function AccountBannedNotice({ bannedAt }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const color = theme.colors.onErrorContainer;

  return (
    <View
      testID="account-banned-notice"
      accessibilityRole="alert"
      style={[s.container, { backgroundColor: theme.colors.errorContainer, borderLeftColor: theme.colors.error }]}
    >
      <View style={s.titleRow}>
        <MaterialIcons name="block" size={18} color={color} />
        <Text style={[s.title, { color }]}>{t("ban.title")}</Text>
      </View>
      <Text style={[s.since, { color }]}>{t("ban.since", { date: formatDate(bannedAt) })}</Text>
      <Text style={{ color }}>{t("ban.body")}</Text>
      <BanContactText style={{ color }} linkColor={color} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderLeftWidth: 4,
    borderRadius: BORDER_RADIUS,
    padding: 12,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontWeight: "700",
  },
  since: {
    fontSize: 12,
  },
});
