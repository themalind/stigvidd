// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { atom } from "jotai";

export const userThemeAtom = atom<"dark" | "light" | "auto">("auto");

export const loadUserTheme = async () => {
  try {
    const theme = await AsyncStorage.getItem("my-theme");
    return (theme as "dark" | "light" | "auto") ?? "auto";
  } catch (e) {
    console.log(e);
    return "auto";
  }
};
