import i18n from "@/i18n";

export function classificationParser(classificationNumber: number): string {
  switch (classificationNumber) {
    case 0:
      return i18n.t("trail.classification.notClassified");
    case 1:
      return i18n.t("trail.classification.easy");
    case 2:
      return i18n.t("trail.classification.medium");
    case 3:
      return i18n.t("trail.classification.hard");
    default:
      return i18n.t("trail.classification.notClassified");
  }
}
