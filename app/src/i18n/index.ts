// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: the default export is the instance, so i18n.use() is intended, not a mistaken named export
/* eslint-disable import/no-named-as-default-member */
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { ParseKeys } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import sv from "./locales/sv.json";

export const LANGUAGE_STORAGE_KEY = "@stigvidd/language";
export type AppLanguage = "sv" | "en";

// keep-comment: opts out of key checking; only for keys unknown at compile time (API data, zod messages,
// keep-comment: `obstacle.types.${type}`), never for a literal key
export function asTranslationKey(key: string): ParseKeys {
  return key as ParseKeys;
}

i18n.use(initReactI18next).init({
  resources: {
    sv: { translation: sv },
    en: { translation: en },
  },
  lng: "sv",
  fallbackLng: "sv",
  interpolation: {
    escapeValue: false,
  },
});

export async function loadStoredLanguage(): Promise<void> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && (stored === "sv" || stored === "en")) {
    await i18n.changeLanguage(stored);
  }
}

export async function changeLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export default i18n;
