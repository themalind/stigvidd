// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

const SIZE = 40;

// keep-comment: round like the iOS 26 bar buttons, the one deliberate exception to BORDER_RADIUS
export default function BackButton() {
  const theme = useTheme();
  const { t } = useTranslation();

  if (Platform.OS !== "ios") return null;

  return (
    <Pressable
      testID="back-button"
      onPress={() => router.back()}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <MaterialIcons name="arrow-back-ios-new" size={20} color={theme.colors.onSurface} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});
