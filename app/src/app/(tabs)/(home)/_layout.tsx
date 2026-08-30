// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Stack } from "expo-router";

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="trail/[identifier]" />
      <Stack.Screen name="follow/[identifier]" />
      <Stack.Screen name="area/[identifier]" />
      <Stack.Screen name="area/area-list-screen" options={{ animation: "none" }} />
    </Stack>
  );
}
