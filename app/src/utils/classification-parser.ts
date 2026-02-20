export function classificationParser(classificationNumber: number): string {
  switch (classificationNumber) {
    case 0:
      return "Inte klassificerad";
    case 1:
      return "Lätt";
    case 2:
      return "Medel";
    case 3:
      return "Svår";
    default:
      return "Inte klassificerad";
  }
}
