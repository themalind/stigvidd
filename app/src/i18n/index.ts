// i18next's default export IS the i18n instance, so i18n.use()/i18n.changeLanguage()
// are the intended API — not a mistaken access of a same-named named export.
/* eslint-disable import/no-named-as-default-member */
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { ParseKeys } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import sv from "./locales/sv.json";

export const LANGUAGE_STORAGE_KEY = "@stigvidd/language";
export type AppLanguage = "sv" | "en";

/**
 * Cast a runtime-computed string to a translation key.
 *
 * Translation keys are type-checked at compile time (see src/@types/i18next.d.ts),
 * so pass literal keys straight to t() — e.g. t("trail.backToTop") — to keep that
 * safety. Use this helper only where the key genuinely isn't known statically —
 * these intentionally opt out of strict key checking, since we can never fully
 * know the set of values:
 *   - data from the API / DB (e.g. area data, currently static but moving to the DB)
 *   - zod validation messages (zod types `message` as plain string)
 *   - keys built at runtime (e.g. `obstacle.types.${type}`)
 */
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
