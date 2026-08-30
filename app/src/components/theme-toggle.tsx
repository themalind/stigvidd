// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useThemeToggle } from "@/hooks/useThemeToggle";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useTheme } from "react-native-paper";

export default function ThemeToggle() {
  const { userTheme, toggleTheme } = useThemeToggle();
  const theme = useTheme();

  return (
    <Pressable onPress={toggleTheme}>
      <MaterialIcons name={userTheme === "light" ? "dark-mode" : "light-mode"} size={35} color={theme.colors.primary} />
    </Pressable>
  );
}
