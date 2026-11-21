// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  onPress: () => void;
}

export default function MapOverlayDismissButton({ onPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      testID="map-overlay-dismiss"
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t("common.close")}
      style={({ pressed }) => [s.button, { backgroundColor: theme.colors.surface }, pressed && s.pressed]}
    >
      <MaterialIcons name="keyboard-arrow-down" size={24} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    alignSelf: "center",
    width: 40,
    height: 28,
    borderRadius: SURFACE_BORDER_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.7,
  },
});
