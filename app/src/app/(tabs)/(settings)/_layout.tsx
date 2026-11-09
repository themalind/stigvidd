// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Stack, useIsFocused } from "expo-router";
import { useTheme } from "react-native-paper";

export default function SettingsLayout() {
  const theme = useTheme();
  const focused = useIsFocused();

  // Unmounted while away, so the next drawer row starts a fresh stack. keep-comment: else back returns to an earlier visit
  if (!focused) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="about" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="theme" />
    </Stack>
  );
}
