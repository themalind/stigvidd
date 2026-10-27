// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SiteContent } from "@/content/site-content";

export default function ScreenshotsSection({
  title,
  screenshots,
}: {
  title: string;
  screenshots: SiteContent["screenshots"];
}) {
  return (
    <section id="bilder" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>

      <ul className="mt-10 grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {screenshots.map((shot) => (
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
