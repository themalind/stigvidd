// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { APP_THEMES, AppDarkTheme, AppDefaultTheme, type AppTheme, type ThemeChoice } from "@/constants/theme";
import { useThemeChoice } from "@/hooks/useThemeChoice";
import ThemePreview from "@/components/settings/theme-preview";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type OptionColors = { background: string; text: string; subtext: string; stripes: string[] };

export default function ThemeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { choice, chooseTheme } = useThemeChoice();

  const lightThemes = APP_THEMES.filter((item) => !item.theme.dark);
  const darkThemes = APP_THEMES.filter((item) => item.theme.dark);

  function renderOption(id: ThemeChoice, label: string, colors: OptionColors, description?: string) {
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
            backgroundColor: colors.background,
            borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <View style={s.stripes}>
          {colors.stripes.map((color, index) => (
            <View key={index} testID={`theme-stripe-${id}-${index}`} style={[s.stripe, { backgroundColor: color }]} />
          ))}
        </View>
        <View style={s.optionText}>
          <Text variant="titleSmall" style={{ color: colors.text }}>
            {label}
          </Text>
          {description && (
            <Text variant="bodySmall" style={{ color: colors.subtext }}>
              {description}
            </Text>
          )}
        </View>
        {selected && <MaterialIcons name="check" size={24} color={colors.text} />}
      </Pressable>
    );
  }

  const systemColors: OptionColors = {
    background: theme.colors.surface,
    text: theme.colors.onSurface,
    subtext: theme.colors.onSurfaceVariant,
    stripes: [AppDefaultTheme.colors.background, AppDarkTheme.colors.background],
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top + 16, backgroundColor: theme.colors.background }]}>
      <View style={[s.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <Text variant="headlineSmall" style={[s.title, { color: theme.colors.onBackground }]}>
          {t("themes.title")}
        </Text>
        <View style={s.previewSection}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("themes.preview.heading")}
          </Text>
          <ThemePreview choice={choice} />
        </View>
      </View>

      <ScrollView testID="theme-screen" contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
        <View accessibilityRole="radiogroup" style={s.list}>
          {renderOption("auto", t("themes.system"), systemColors, t("themes.systemDescription"))}

          <Text variant="labelLarge" style={[s.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t("themes.light")}
          </Text>
          {lightThemes.map((item) => renderOption(item.id, t(`themes.${item.id}`), themeColors(item.theme)))}

          <Text variant="labelLarge" style={[s.groupLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t("themes.dark")}
          </Text>
          {darkThemes.map((item) => renderOption(item.id, t(`themes.${item.id}`), themeColors(item.theme)))}
        </View>
      </ScrollView>
    </View>
  );
}

function themeColors({ colors }: AppTheme): OptionColors {
  return {
    background: colors.background,
    text: colors.onBackground,
    subtext: colors.onSurfaceVariant,
    stripes: [colors.primary, colors.secondary, colors.tertiary],
  };
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 24, gap: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  previewSection: { gap: 8 },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  title: { fontWeight: "600" },
  list: { gap: 10 },
  groupLabel: { marginTop: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 56,
    paddingRight: 12,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  stripes: { flexDirection: "row", alignSelf: "stretch", width: 96 },
  stripe: { flex: 1 },
  optionText: { flex: 1, gap: 2, paddingVertical: 12 },
});
