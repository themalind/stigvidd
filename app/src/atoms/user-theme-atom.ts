// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isThemeChoice, type ThemeChoice } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { atom } from "jotai";
import { logger } from "../services/logger";

const STORAGE_KEY = "my-theme";

// Values stored by the old light/dark toggle.
const LEGACY_CHOICES: Record<string, ThemeChoice> = { light: "petroleum", dark: "bivack" };

export const userThemeAtom = atom<ThemeChoice>("auto");

export const loadUserTheme = async (): Promise<ThemeChoice> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === null) return "auto";
    if (isThemeChoice(stored)) return stored;
    return LEGACY_CHOICES[stored] ?? "auto";
  } catch (e) {
    logger.warn("Could not read the stored theme; falling back to auto", { error: String(e) });
    return "auto";
  }
};

export const saveUserTheme = async (choice: ThemeChoice) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, choice);
  } catch (e) {
    logger.warn("Could not persist the theme choice", { error: String(e) });
  }
};
