import i18n from "@/i18n";

export default function issueTypeParser(issueType: string): string {
  const key = `obstacle.types.${issueType}` as const;
  const translated = i18n.t(key);
  return translated !== key ? translated : i18n.t("obstacle.types.Other");
}
