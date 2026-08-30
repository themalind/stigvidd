// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Platform, Pressable, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

export default function BackButton() {
  const theme = useTheme();

  if (Platform.OS !== "ios") return null;

  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={s.button}>
      <MaterialIcons name="chevron-left" size={32} color={theme.colors.onBackground} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    paddingLeft: 4,
  },
});
