// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Every word on the public site, in one file.
 *
 * The product description and tagline are COPIED FROM THE APP —
 * keep-comment: `app/src/i18n/locales/{sv,en}.json`, key `about`. That is the text the About screen already
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

export const sourceUrl = "https://github.com/themalind/stigvidd";

// keep-comment: null renders no button for that platform, so testers on it are recruited by mail
export const installLinks: { ios: string | null; android: string | null } = {
  ios: "https://apps.apple.com/se/app/stigvidd/id6818785238",
  android: null,
};

export type Locale = "sv" | "en";

export type FeatureIcon =
  | "map-pinned"
  | "navigation"
  | "footprints"
  | "star"
  | "heart"
  | "triangle-alert"
  | "users"
  | "send"
  | "thumbs-up"
  | "compass"
  | "dices"
  | "book-open";

type Link = { href: string; label: string };

export type SiteContent = {
  skipLink: string;
  header: {
    home: string;
    navLabel: string;
    nav: Link[];
    otherLanguage: Link & { lang: Locale };
  };
  hero: {
    badge: string;
    title: string;
    tagline: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    imageAlt: string;
  };
  featuresTitle: string;
  features: { title: string; body: string; icon: FeatureIcon }[];
  screenshotsTitle: string;
  // keep-comment: alt says what the screen does, not that it is a screenshot; a screen reader announces the image
  screenshots: { src: string; alt: string; caption: string }[];
  installLabels: { ios: string; android: string };
  install: {
    title: string;
    body: string;
    mailCta: string;
    mailSubject: string;
    steps: { title: string; body: string }[];
  };
  faqTitle: string;
  faq: { question: string; answer: string }[];
  sources: { title: string; body: string };
  footer: {
    tagline: string;
    navLabel: string;
    contact: string;
    source: string;
    // keep-comment: files under public/, linked with plain <a href>; the trailing slash is load-bearing
    legal: Link[];
  };
};

const sv: SiteContent = {
  skipLink: "Hoppa till innehållet",
  header: {
    home: "/",
    navLabel: "Huvudmeny",
    nav: [
      { href: "#funktioner", label: "Funktioner" },
      { href: "#bilder", label: "Bilder" },
      { href: "#hamta", label: "Hämta appen" },
      { href: "#fragor", label: "Frågor" },
    ],
    otherLanguage: { href: "/en/", label: "English", lang: "en" },
  },
  hero: {
    badge: "Betaversion – sluten testperiod",
    title: "Stigvidd",
    tagline: "Upptäck leder nära dig",
    description:
      "Stigvidd är en vandringsapp skapad som ett hobbyprojekt, av kärlek till naturen. " +
      "Utforska vandringsleder i Boråsområdet, spela in egna vandringar med GPS, betygsätt " +
      "lederna du gillar och hjälp andra vandrare genom att rapportera hinder längs vägen.",
    primaryCta: "Hämta appen",
    secondaryCta: "Det här kan du göra",
    imageAlt: "Startskärmen i Stigvidd med väder, hälsning och populära promenader nära dig",
  },
  featuresTitle: "Det här kan du göra",
  features: [
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
  ],
  screenshotsTitle: "Så ser det ut",
  screenshots: [
    {
      src: "/screenshots/home-recent-walk.webp",
      alt:
        "Nedre delen av startskärmen med din senaste promenad inritad på kartan och en " +
        "knapp som slumpar fram en promenad åt dig",
      caption: "Låt appen välja",
    },
    {
      src: "/screenshots/map-satellite.webp",
      alt: "Satellitkartan över Bollebygd med leder samlade i grupper och ett kort för en användarpromenad längst ned",
      caption: "Leder på kartan",
    },
    {
      src: "/screenshots/trail-detail-screen.webp",
      alt: "Ledsidan med bildgalleri, betyg och uppgifter om markering, längd och svårighetsgrad",
      caption: "Allt om leden",
    },
    {
      src: "/screenshots/trail-practical-info.webp",
      alt:
        "Praktisk information om leden — startplats, busshållplats och parkering — över en " +
        "karta med ledens sträckning och vägbeskrivning till starten",
      caption: "Ta dig dit",
    },
    {
      src: "/screenshots/community-trails.webp",
      alt: "Promenader som andra vandrare har publicerat som leder, med längd, upphovsperson och antal gillanden",
      caption: "Delat av andra vandrare",
    },
  ],
  installLabels: {
    ios: "Hämta i App Store",
    android: "Hämta på Google Play",
  },
  install: {
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
  },
  faqTitle: "Vanliga frågor",
  faq: [
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
  ],
  sources: {
    title: "Data & källor",
    body:
      "Leddata för Boråsområdet kommer från Borås Stads öppna dataportal och tillhandahålls " +
      "under Creative Commons CC0 1.0. Kartor tillhandahålls av MapTiler och MapLibre och " +
      "bygger på OpenStreetMap under ODbL 1.0.",
  },
  footer: {
    tagline: "Skapad med omtanke om naturen",
    navLabel: "Om och villkor",
    contact: "Kontakt",
    source: "Källkod",
    legal: [
      { href: "/privacy-policy/", label: "Integritetspolicy" },
      { href: "/terms-of-use/", label: "Användarvillkor" },
      { href: "/delete-account/", label: "Radera konto" },
    ],
  },
};

const en: SiteContent = {
  skipLink: "Skip to content",
  header: {
    home: "/en/",
    navLabel: "Main menu",
    nav: [
      { href: "#funktioner", label: "Features" },
      { href: "#bilder", label: "Screenshots" },
      { href: "#hamta", label: "Get the app" },
      { href: "#fragor", label: "FAQ" },
    ],
    otherLanguage: { href: "/", label: "Svenska", lang: "sv" },
  },
  hero: {
    badge: "Beta – closed testing",
    title: "Stigvidd",
    tagline: "Discover trails near you",
    description:
      "Stigvidd is a hiking app made as a hobby project, for the love of the outdoors. " +
      "Explore trails in the Borås area, record your own walks with GPS, rate the trails " +
      "you enjoy and help other hikers by reporting obstacles along the way.",
    primaryCta: "Get the app",
    secondaryCta: "What you can do",
    imageAlt: "The Stigvidd start screen with the weather, a greeting and popular walks near you",
  },
  featuresTitle: "What you can do",
  features: [
    {
      title: "Find a trail",
      body: "Explore and filter hiking trails by difficulty, accessibility and length.",
      icon: "map-pinned",
    },
    {
      title: "Get there",
      body: "Follow an interactive map with directions to the trailhead.",
      icon: "navigation",
    },
    {
      title: "Record your walk",
      body: "Record your walks with GPS and see the distance you cover.",
      icon: "footprints",
    },
    {
      title: "Rate and review",
      body: "Rate trails and share your photos in reviews.",
      icon: "star",
    },
    {
      title: "Save favorites",
      body: "Save favorites and build a wishlist of trails to try.",
      icon: "heart",
    },
    {
      title: "Warn about obstacles",
      body: "Report obstacles and hazards to help other hikers.",
      icon: "triangle-alert",
    },
    {
      title: "Share with friends",
      body: "Share your recorded walks with friends.",
      icon: "users",
    },
    {
      title: "Publish as a trail",
      body: "Publish your walk as a trail so more people can walk it.",
      icon: "send",
    },
    {
      title: "Discover other trails",
      body: "Discover and like trails that other hikers have published.",
      icon: "thumbs-up",
    },
    {
      title: "Explore areas",
      body: "Explore outdoor areas around Borås, such as Rya åsar and Kype.",
      icon: "compass",
    },
    {
      title: "Let the app choose",
      body: "Let Stigvidd pick a walk for you when you cannot decide.",
      icon: "dices",
    },
    {
      title: "Know the rules",
      body: "Read up on the right of public access, nature reserves and difficulty grades in the nature guide.",
      icon: "book-open",
    },
  ],
  screenshotsTitle: "Take a look",
  screenshots: [
    {
      src: "/screenshots/home-recent-walk.webp",
      alt:
        "The lower half of the start screen, with your latest walk drawn on the map and a " +
        "button that picks a walk for you",
      caption: "Let the app choose",
    },
    {
      src: "/screenshots/map-satellite.webp",
      alt: "The satellite map over Bollebygd with trails grouped together and a card for a walk shared by a user at the bottom",
      caption: "Trails on the map",
    },
    {
      src: "/screenshots/trail-detail-screen.webp",
      alt: "The trail page with a photo gallery, a rating and details on markings, length and difficulty",
      caption: "All about the trail",
    },
    {
      src: "/screenshots/trail-practical-info.webp",
      alt:
        "Practical information about the trail — starting point, bus stop and parking — over a " +
        "map of the route with directions to the start",
      caption: "Get there",
    },
    {
      src: "/screenshots/community-trails.webp",
      alt: "Walks that other hikers have published as trails, with length, author and number of likes",
      caption: "Shared by other hikers",
    },
  ],
  installLabels: {
    ios: "Download on the App Store",
    android: "Get it on Google Play",
  },
  install: {
    title: "Get Stigvidd",
    body:
      "Stigvidd is on the App Store for iPhone. The Android version is in closed testing – " +
      "email us and we will send you a test link.",
    mailCta: "Try it on Android",
    mailSubject: "I want to test Stigvidd on Android",
    steps: [
      {
        title: "Get the app",
        body: `On iPhone, get Stigvidd from the App Store. On Android, email ${contactEmail} and we will send you a link.`,
      },
      {
        title: "Find a trail",
        body: "Browse the trails in the Borås area, or let the app pick a walk for you.",
      },
      {
        title: "Go for a walk",
        body: "Record the walk with GPS and see how far you went.",
      },
      {
        title: "Tell us what you think",
        body: `Glitches, oddities and wishes – it all goes to ${contactEmail}.`,
      },
    ],
  },
  faqTitle: "Frequently asked questions",
  faq: [
    {
      question: "Which trails are in the app?",
      answer:
        "Trails in the Borås area. Trail data comes from the City of Borås open data portal " +
        "and is provided under Creative Commons CC0 1.0. On top of that come trails that other " +
        "hikers have published from their own walks, reviewed by Stigvidd.",
    },
    {
      question: "What does the app cost?",
      answer: "Nothing. Stigvidd is a hobby project, shows no ads and sells no data.",
    },
    {
      question: "Does the app track where I am?",
      answer:
        "Your location is only recorded while you record a walk, and your walks stay private " +
        "until you share them yourself. Usage statistics are only collected if you agree to " +
        "them, never include your position, and can be switched off at any time in Settings.",
    },
    {
      question: "Can I read the code?",
      answer:
        "Yes. Stigvidd is free software – the app under the Mozilla Public License 2.0 and " +
        "the server under the GNU Affero General Public License version 3.",
    },
  ],
  sources: {
    title: "Data & credits",
    body:
      "Trail data for the Borås area comes from the City of Borås open data portal and is " +
      "provided under Creative Commons CC0 1.0. Maps are provided by MapTiler and MapLibre and " +
      "are based on OpenStreetMap under ODbL 1.0.",
  },
  footer: {
    tagline: "Made with care for the outdoors",
    navLabel: "About and legal",
    contact: "Contact",
    source: "Source code",
    legal: [
      { href: "/privacy-policy/#english", label: "Privacy policy" },
      { href: "/terms-of-use/#english", label: "Terms of use" },
      { href: "/delete-account/#english", label: "Delete account" },
    ],
  },
};

export const siteContent: Record<Locale, SiteContent> = { sv, en };
