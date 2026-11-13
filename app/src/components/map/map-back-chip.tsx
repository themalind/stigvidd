// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  title?: string;
  // keep-comment: laid out in a row by its parent instead of pinned top-left, so it shrinks to the room beside a top-right control
  inline?: boolean;
}

export default function MapBackChip({ title, inline = false }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      style={[
        title ? s.backChip : s.iconButton,
        inline ? s.inline : s.pinned,
        { backgroundColor: theme.colors.surface },
      ]}
    >
      <MaterialIcons name="arrow-back" size={24} color={theme.colors.onSurface} />
      {title && (
        <Text style={[s.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  pinned: {
    position: "absolute",
    top: SCREEN_PADDING,
    left: SURFACE_BORDER_RADIUS,
    maxWidth: "70%",
  },
  inline: {
    flexShrink: 1,
  },
  backChip: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: SURFACE_BORDER_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
