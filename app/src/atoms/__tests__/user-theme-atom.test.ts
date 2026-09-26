// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { loadUserTheme, saveUserTheme } from "@/atoms/user-theme-atom";
import AsyncStorage from "@react-native-async-storage/async-storage";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it("follows the system when nothing is stored", async () => {
  expect(await loadUserTheme()).toBe("auto");
});

it("restores a stored theme", async () => {
  await saveUserTheme("stjarnhimmel");

  expect(await loadUserTheme()).toBe("stjarnhimmel");
});

// Installs updated from the light/dark toggle keep what they had.
it.each([
  ["light", "petroleum"],
  ["dark", "bivack"],
])("maps the old toggle's %s to %s", async (stored, expected) => {
  await AsyncStorage.setItem("my-theme", stored);

  expect(await loadUserTheme()).toBe(expected);
});

// A theme removed in a later release must not leave the app without one.
it("falls back to the system for a theme that no longer exists", async () => {
  await AsyncStorage.setItem("my-theme", "obsidian");

  expect(await loadUserTheme()).toBe("auto");
});

it("falls back to the system when storage cannot be read", async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("disk"));

  expect(await loadUserTheme()).toBe("auto");
});
