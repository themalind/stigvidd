// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Real screenshots of the real app, from screenshots/ at the repo root. Each alt text
// says what the screen DOES, not that it is a screenshot — a screen reader already
// announces the image.
const SHOTS = [
  {
    // Picks up where the hero leaves off: that shows the top of the start screen, this
    // is the bottom of the same screen.
    src: "/screenshots/start-screen-bottom.webp",
    alt:
      "Nedre delen av startskärmen med Naturguide, Utforska Borås och en knapp som " +
      "slumpar fram en promenad åt dig",
    caption: "Låt appen välja",
  },
  {
    src: "/screenshots/map_overview.webp",
    alt: "Kartan över Boråsområdet med leder samlade i grupper och ett ledkort längst ned",
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
    src: "/screenshots/trail-information.webp",
    alt:
      "Varning om rapporterade hinder längs leden, och knappar för att spara, dela, " +
      "betygsätta och rapportera",
    caption: "Hinder och omdömen",
  },
];

export default function ScreenshotsSection() {
  return (
    <section id="bilder" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Så ser det ut</h2>

      <ul className="mt-10 grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {SHOTS.map((shot) => (
          <li key={shot.src}>
            <img
              src={shot.src}
              alt={shot.alt}
              className="w-full rounded-base border border-border shadow-lg"
              loading="lazy"
            />
            <p className="mt-3 text-center text-sm text-muted">{shot.caption}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
