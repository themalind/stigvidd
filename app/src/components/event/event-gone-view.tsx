// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { leaveEventScreen } from "./event-routes";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

// A push or link to an event that was deleted or that this user can no longer see. keep-comment: never says which, a reason could reveal a block or a report
export default function EventGoneView() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View testID="event-gone" style={[s.container, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons name="calendar-remove-outline" size={56} color={theme.colors.onSurfaceVariant} />
      <Text style={[s.title, { color: theme.colors.onBackground }]}>{t("events.gone.title")}</Text>
      <Text style={[s.body, { color: theme.colors.onSurfaceVariant }]}>{t("events.gone.body")}</Text>
      <Button mode="contained" onPress={leaveEventScreen} style={s.button}>
        {t("common.back")}
      </Button>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
  },
});
