// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Every word on the public site, in one file.
 *
 * The product description and tagline are COPIED FROM THE APP —
 * `app/src/i18n/locales/sv.json`, key `about`. That is the text the About screen already
 * shows, so keeping the two identical is the whole point: a landing page that describes a
 * different product than the app is worse than no landing page. When the app's copy
 * changes, change it here too. Nothing checks that they agree.
 *
 * The feature list is the app's `about.features` array, one card per entry, in the same
 * order — ten of them. Three were added to that array when this site was built: the areas
 * browser, the trail randomiser and the nature guide, all three real features that the
 * About screen had never listed. `about-screen.test.tsx` asserts the count, so the app
 * side cannot lose one silently; this side has no such guard, so the order and wording
 * here are kept in step by hand.
 *
 * `phase` is what turns the tester page into the public one. In "beta" the install
 * section recruits testers; in "public" it shows store links. Flip it, fill in
 * `installLinks`, and the page is a launch page — no component changes.
 */

export type SitePhase = "beta" | "public";

export const phase: SitePhase = "beta";

export const contactEmail = "info@stigvidd.se";

export const hero = {
  badge: "Betaversion – sluten testperiod",
  title: "Stigvidd",
  tagline: "Upptäck leder nära dig",
  description:
    "Stigvidd är en vandringsapp skapad som ett hobbyprojekt, av kärlek till naturen. " +
    "Utforska vandringsleder i Boråsområdet, spela in egna vandringar med GPS, betygsätt " +
    "lederna du gillar och hjälp andra vandrare genom att rapportera hinder längs vägen.",
  primaryCta: "Bli testare",
  secondaryCta: "Det här kan du göra",
};

export const features = [
  {
    title: "Hitta leden",
    body: "Utforska och filtrera vandringsleder efter svårighetsgrad, tillgänglighet och längd.",
    icon: "map-pinned",
  },
  {
    title: "Ta dig dit",
    body: "Följ en interaktiv karta med vägbeskrivning till ledens start.",
    icon: "navigation",
  },
  {
    title: "Spela in vandringen",
    body: "Spela in dina vandringar med GPS och se hur långt du går.",
    icon: "footprints",
  },
  {
    title: "Betygsätt och berätta",
    body: "Betygsätt leder och dela dina foton i recensioner.",
    icon: "star",
  },
  {
    title: "Spara favoriter",
    body: "Spara favoriter och bygg en önskelista med leder att testa.",
    icon: "heart",
  },
  {
    title: "Varna för hinder",
    body: "Rapportera hinder och faror för att hjälpa andra vandrare.",
    icon: "triangle-alert",
  },
  {
    title: "Dela med vänner",
    body: "Dela dina inspelade vandringar med vänner.",
    icon: "users",
  },
  {
    title: "Utforska områden",
    body: "Utforska friluftsområden i Boråstrakten, som Rya åsar och Kype.",
    icon: "compass",
  },
  {
    title: "Låt appen välja",
    body: "Låt Stigvidd slumpa fram en promenad när du inte kan bestämma dig.",
    icon: "dices",
  },
  {
    title: "Kunna reglerna",
    body: "Läs på om allemansrätten, naturreservat och svårighetsgrader i naturguiden.",
    icon: "book-open",
  },
] as const;

/**
 * The store links. `null` means "does not exist yet" and the install section renders no
 * store button at all — testers are recruited by mail until there is somewhere to send
 * them. Nothing is registered with App Store Connect or Play Console yet; when a build is
 * uploaded, put the invite URL here and the buttons appear on their own.
 */
export const installLinks: { ios: string | null; android: string | null } = {
  ios: null,
  android: null,
};

export const install = {
  title: "Var med och testa",
  body:
    "Stigvidd är i sluten testperiod. Testarna får appen före alla andra, och det som " +
    "rapporteras nu är det som hinner bli bättre innan lanseringen.",
  steps: [
    {
      title: "Hör av dig",
      body: `Mejla ${contactEmail} och berätta om du vandrar med iPhone eller Android.`,
    },
    {
      title: "Få din inbjudan",
      body: "Du får ett mejl med en länk som installerar appen på din telefon.",
    },
    {
      title: "Gå en tur",
      body: "Använd appen som du hade gjort ändå. Det är då bristerna syns.",
    },
    {
      title: "Berätta vad som hände",
      body: `Krångel, konstigheter och önskemål – allt går till ${contactEmail}.`,
    },
  ],
};

export const faq = [
  {
    question: "Vilka leder finns i appen?",
    answer:
      "Leder i Boråsområdet. Leddata kommer från Borås Stads öppna dataportal och " +
      "tillhandahålls under Creative Commons CC0 1.0.",
  },
  {
    question: "Vad kostar appen?",
    answer:
      "Ingenting. Stigvidd är ett hobbyprojekt, visar inga annonser och säljer inga uppgifter.",
  },
  {
    question: "Spårar appen var jag är?",
    answer:
      "Din position spelas bara in medan du registrerar en vandring, och dina vandringar " +
      "är privata tills du själv delar dem. Användningsstatistik samlas bara in om du " +
      "samtycker, innehåller aldrig din position och kan stängas av när som helst under " +
      "Inställningar.",
  },
  {
    question: "Kan jag läsa koden?",
    answer:
      "Ja. Stigvidd är fri programvara – appen under Mozilla Public License 2.0 och " +
      "servern under GNU Affero General Public License version 3.",
  },
];

export const sources = {
  title: "Data & källor",
  body:
    "Leddata för Boråsområdet kommer från Borås Stads öppna dataportal och tillhandahålls " +
    "under Creative Commons CC0 1.0. Kartor tillhandahålls av MapTiler och MapLibre och " +
    "bygger på OpenStreetMap under ODbL 1.0.",
};

export const footer = {
  tagline: "Skapad med omtanke om naturen",
  sourceUrl: "https://github.com/themalind/stigvidd",
  // Plain <a href> to real files, never a client-side route: these are directories
  // under public/ and the trailing slash is load-bearing.
  legal: [
    { href: "/privacy-policy/", label: "Integritetspolicy" },
    { href: "/terms-of-use/", label: "Användarvillkor" },
    { href: "/delete-account/", label: "Radera konto" },
  ],
};
