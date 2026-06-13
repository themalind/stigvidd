// Type-safety for translation keys.
// Augments i18next so `t("...")` keys are autocompleted and checked at compile
// time against sv.json (the source-of-truth locale). A typo or missing key
// becomes a TypeScript error instead of a silent runtime miss.
import "i18next";
import sv from "../i18n/locales/sv.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof sv;
    };
  }
}
