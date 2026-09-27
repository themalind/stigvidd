// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { resolveTheme, type ThemeChoice } from "@/constants/theme";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Button, Chip, Text } from "react-native-paper";

export default function ThemePreview({ choice }: { choice: ThemeChoice }) {
  const { t } = useTranslation();
  const theme = resolveTheme(choice, useColorScheme());
  const { colors } = theme;

  return (
    <View
      testID="theme-preview"
      accessible
      accessibilityLabel={t("themes.preview.label")}
      style={[s.card, { backgroundColor: colors.elevation.level2, borderColor: colors.outlineVariant }]}
    >
      <View style={s.header}>
        <MaterialIcons name="terrain" size={28} color={colors.tertiary} />
        <View style={s.headerText}>
          <Text variant="titleMedium" style={{ color: colors.onSurface }}>
            {t("themes.preview.title")}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {t("themes.preview.details")}
          </Text>
        </View>
      </View>
      <View style={s.row}>
        <Chip theme={theme} compact style={s.radius}>
          {t("themes.preview.forest")}
        </Chip>
        <Chip theme={theme} compact style={s.radius}>
          {t("themes.preview.view")}
        </Chip>
      </View>
      <View style={s.row}>
        <Button theme={theme} mode="contained" style={s.radius}>
          {t("themes.preview.start")}
        </Button>
        <Button theme={theme} mode="outlined" style={s.radius}>
          {t("themes.preview.save")}
        </Button>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { gap: 12, padding: 14, borderRadius: BORDER_RADIUS, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 2 },
  row: { flexDirection: "row", gap: 8 },
  radius: { borderRadius: BORDER_RADIUS },
});
