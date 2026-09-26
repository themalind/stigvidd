// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userThemeAtom } from "@/atoms/user-theme-atom";
import { resolveTheme } from "@/constants/theme";
import * as NavigationBar from "expo-navigation-bar";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";

export function useUserTheme() {
  const userTheme = useAtomValue(userThemeAtom);
  const colorScheme = useColorScheme();
  const theme = resolveTheme(userTheme, colorScheme);

  // Uppdatera navigation bar på Android
  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setButtonStyleAsync(theme.dark ? "light" : "dark");
    }
  }, [theme.dark]);

  return theme;
}
