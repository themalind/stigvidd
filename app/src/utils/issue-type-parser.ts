import i18n, { asTranslationKey } from "@/i18n";

export default function issueTypeParser(issueType: string): string {
  const key = `obstacle.types.${issueType}`;
  const translated = i18n.t(asTranslationKey(key));
  return translated !== key ? translated : i18n.t("obstacle.types.Other");
}
