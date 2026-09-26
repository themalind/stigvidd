// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { APP_THEMES, AppDarkTheme, AppDefaultTheme, type AppTheme, type ThemeChoice } from "@/constants/theme";
import { useThemeChoice } from "@/hooks/useThemeChoice";
import { MaterialIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ThemeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { choice, chooseTheme } = useThemeChoice();

  const lightThemes = APP_THEMES.filter((item) => !item.theme.dark);
  const darkThemes = APP_THEMES.filter((item) => item.theme.dark);

  function renderOption(id: ThemeChoice, label: string, preview: ReactNode, description?: string) {
    const selected = choice === id;
    return (
      <Pressable
        key={id}
        testID={`theme-option-${id}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={() => chooseTheme(id)}
        style={[
          s.option,
          {
            backgroundColor: theme.colors.surface,
            borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        {preview}
        <View style={s.optionText}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
            {label}
          </Text>
          {description && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {description}
            </Text>
          )}
        </View>
        {selected && <MaterialIcons name="check" size={24} color={theme.colors.primary} />}
      </Pressable>
    );
  }

  return (
    <ScrollView
      testID="theme-screen"
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text variant="headlineSmall" style={[s.title, { color: theme.colors.onBackground }]}>
        {t("themes.title")}
      </Text>

      <View accessibilityRole="radiogroup" style={s.list}>
        {renderOption("auto", t("themes.system"), <SystemPreview />, t("themes.systemDescription"))}

        <Text variant="labelLarge" style={[s.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
          {t("themes.light")}
        </Text>
        {lightThemes.map((item) =>
          renderOption(
            item.id,
            t(`themes.${item.id}`),
            <ThemePreview testID={`theme-preview-${item.id}`} theme={item.theme} />,
          ),
        )}

        <Text variant="labelLarge" style={[s.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
          {t("themes.dark")}
        </Text>
        {darkThemes.map((item) =>
          renderOption(
            item.id,
            t(`themes.${item.id}`),
            <ThemePreview testID={`theme-preview-${item.id}`} theme={item.theme} />,
          ),
        )}
      </View>
    </ScrollView>
  );
}

function ThemePreview({ theme, testID }: { theme: AppTheme; testID: string }) {
  const { colors } = theme;
  return (
    <View
      testID={testID}
      style={[s.preview, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
    >
      <View style={[s.previewSurface, { backgroundColor: colors.surface }]}>
        {(["primary", "secondary", "tertiary"] as const).map((role) => (
          <View key={role} style={[s.dot, { backgroundColor: colors[role] }]} />
        ))}
      </View>
    </View>
  );
}

function SystemPreview() {
  return (
    <View style={[s.preview, s.systemPreview, { borderColor: AppDefaultTheme.colors.outlineVariant }]}>
      <View style={[s.half, { backgroundColor: AppDefaultTheme.colors.background }]}>
        <View style={[s.dot, { backgroundColor: AppDefaultTheme.colors.primary }]} />
      </View>
      <View style={[s.half, { backgroundColor: AppDarkTheme.colors.background }]}>
        <View style={[s.dot, { backgroundColor: AppDarkTheme.colors.primary }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 16 },
  title: { fontWeight: "600" },
  list: { gap: 10 },
  groupLabel: { marginTop: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: BORDER_RADIUS,
  },
  optionText: { flex: 1, gap: 2 },
  preview: {
    width: 64,
    height: 44,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    padding: 6,
    overflow: "hidden",
  },
  previewSurface: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: BORDER_RADIUS,
  },
  systemPreview: { flexDirection: "row", padding: 0 },
  half: { flex: 1, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
