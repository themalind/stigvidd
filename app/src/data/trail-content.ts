export interface DifficultyInfo {
  value: number;
  label: string;
  description: string;
}

export interface AccessibilityInfo {
  title: string;
  description: string;
  iconName: "wheelchair-accessibility" | "hiking";
}

export const DIFFICULTIES: DifficultyInfo[] = [
  {
    value: 1,
    label: "Lätt",
    description:
      "På leder som har svårighetsnivå lätt är det möjligt att ta sig fram med barnvagn. Underlaget på leden är till största delen hårdgjord yta.",
  },
  {
    value: 2,
    label: "Medel",
    description:
      "De leder som har svårighetsnivå medel går ofta på mindre vägar och naturstigar. Under normala väderförhållanden krävs inga kängor eller stövlar här, och för en person med normal kondition är nivåskillnaden inga problem.",
  },
  {
    value: 3,
    label: "Svår",
    description:
      "En led med svårighetsnivå svår går ofta på naturstig. Här finns sträckor som innehåller stora nivåskillnader eller branta passager, och därför behövs god kondition och ordentliga vandringskängor eller stövlar.",
  },
  {
    value: 0,
    label: "Inte klassificerad",
    description: "Ingen officiell klassificering finns.",
  },
];

export const ACCESSIBILITY_INFO: AccessibilityInfo[] = [
  {
    title: "Tillgänglighetsanpassad",
    iconName: "wheelchair-accessibility",
    description:
      "Platser som är anpassade är tillgängliga för alla, så att fler kan få ta del av friluftslivet – oavsett fysiska förutsättningar. Underlaget är jämnt och fast, lutningen är begränsad och bredden tilltagen, så att det går att ta sig fram med exempelvis rullstol, rollator eller barnvagn.\n\nVad som finns på plats varierar – det kan handla om vilobänkar, anpassade rast- och grillplatser, ramp eller badstol vid vatten, tillgänglig toalett eller parkering för rörelsehindrade. I appen ser du vilka platser som är tillgänglighetsanpassade och vad som erbjuds på varje ställe, så att du enkelt kan hitta ett besöksmål som passar dina förutsättningar.",
  },
  {
    title: "Ej tillgänglighetsanpassad",
    iconName: "hiking",
    description:
      "En plats eller led som inte är tillgänglighetsanpassad utgår från naturens egna förutsättningar. Underlaget kan vara ojämnt med stenar, rötter, lera eller sand, och sträckan kan innehålla backar, trappor, smala passager eller spänger.\n\nAnpassade sittplatser, ramper, toaletter eller särskild parkering kan saknas helt eller delvis. Förhållandena varierar mellan olika platser, och i appen hittar du information om varje enskilt besöksmål samt svårighetsgrad för leder.",
  },
];
