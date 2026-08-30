// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Stack } from "expo-router";
import { useAuth } from "@/components/auth/auth-provider";

export default function ProfileStackLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" options={{ animation: "none" }} />
        <Stack.Screen name="register" options={{ animation: "none" }} />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="profile-page" />
        <Stack.Screen name="about" />
        <Stack.Screen name="trail/[identifier]" />
        <Stack.Screen name="follow/[identifier]" />
        <Stack.Screen name="hike-follow/[identifier]" />
        <Stack.Screen name="user/favorites" />
        <Stack.Screen name="user/wishlist" />
        <Stack.Screen name="user/my-hikes" />
        <Stack.Screen name="user/create-hike" />
        <Stack.Screen name="user/shared-hikes" />
        <Stack.Screen name="user/friends" />
      </Stack.Protected>
    </Stack>
  );
}
