// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { loadBasemap, saveBasemap } from "@/atoms/basemap-atom";
import AsyncStorage from "@react-native-async-storage/async-storage";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it("starts on the outdoor map when nothing is stored", async () => {
  expect(await loadBasemap()).toBe("outdoor");
});

it("restores a stored satellite choice", async () => {
  await saveBasemap("satellite");

  expect(await loadBasemap()).toBe("satellite");
});

it("falls back to outdoor for an unknown stored value", async () => {
  await AsyncStorage.setItem("my-basemap", "terrain");

  expect(await loadBasemap()).toBe("outdoor");
});

it("falls back to outdoor when storage cannot be read", async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("disk"));

  expect(await loadBasemap()).toBe("outdoor");
});
