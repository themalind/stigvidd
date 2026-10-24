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
 * keep-comment: the feature list mirrors the app's `about.features`, one card per entry, same order and wording;
 * keep-comment: nothing checks this side, so change both together (`about-screen.test.tsx` pins the app's count).
 *
 * keep-comment: `phase` only shows the beta badge; the buttons come from `installLinks`, so a store goes live by filling in its URL.
 */

export type SitePhase = "beta" | "public";

export const phase: SitePhase = "public";

export const contactEmail = "info@stigvidd.se";

export const hero = {
  badge: "Betaversion – sluten testperiod",
  title: "Stigvidd",
  tagline: "Upptäck leder nära dig",
  description:
    "Stigvidd är en vandringsapp skapad som ett hobbyprojekt, av kärlek till naturen. " +
    "Utforska vandringsleder i Boråsområdet, spela in egna vandringar med GPS, betygsätt " +
    "lederna du gillar och hjälp andra vandrare genom att rapportera hinder längs vägen.",
  primaryCta: "Hämta appen",
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
    title: "Publicera som led",
    body: "Publicera din promenad som en led så att fler kan gå den.",
    icon: "send",
  },
  {
    title: "Upptäck andras leder",
    body: "Upptäck och gilla leder som andra vandrare har publicerat.",
    icon: "thumbs-up",
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

// keep-comment: null renders no button for that platform, so testers on it are recruited by mail
export const installLinks: { ios: string | null; android: string | null } = {
  ios: "https://apps.apple.com/se/app/stigvidd/id6818785238",
  android: null,
};

export const installLabels = {
  ios: "Hämta i App Store",
  android: "Hämta på Google Play",
};

export const install = {
  title: "Hämta Stigvidd",
  body:
    "Stigvidd finns i App Store för iPhone. Android-versionen är i sluten testperiod – " +
    "mejla oss så får du en testlänk.",
  mailCta: "Testa på Android",
  mailSubject: "Jag vill testa Stigvidd på Android",
  steps: [
    {
      title: "Hämta appen",
      body: `Har du iPhone hämtar du Stigvidd i App Store. Har du Android, mejla ${contactEmail} så får du en länk.`,
    },
    {
      title: "Hitta en led",
      body: "Leta bland lederna i Boråsområdet, eller låt appen slumpa fram en promenad.",
    },
    {
      title: "Gå en tur",
      body: "Spela in vandringen med GPS och se hur långt du gick.",
    },
    {
      title: "Berätta vad du tycker",
      body: `Krångel, konstigheter och önskemål – allt går till ${contactEmail}.`,
    },
  ],
};

export const faq = [
  {
    question: "Vilka leder finns i appen?",
    answer:
      "Leder i Boråsområdet. Leddata kommer från Borås Stads öppna dataportal och " +
      "tillhandahålls under Creative Commons CC0 1.0. Till det kommer leder som andra " +
      "vandrare har publicerat från sina egna promenader, granskade av Stigvidd.",
  },
  {
    question: "Vad kostar appen?",
    answer: "Ingenting. Stigvidd är ett hobbyprojekt, visar inga annonser och säljer inga uppgifter.",
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
