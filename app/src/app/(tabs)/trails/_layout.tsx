// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Stack } from "expo-router";

// A linked trail opens with the list beneath it. keep-comment: why the anchor exists (docs/notes/router-push-into-unmounted-tab-has-no-back.md)
export const unstable_settings = { anchor: "index" };

export default function TrailsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="trail/[identifier]" />
      <Stack.Screen name="follow/[identifier]" />
      <Stack.Screen name="guide" />
    </Stack>
  );
}
