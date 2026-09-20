// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { hero, phase } from "@/content/site-content";

export default function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-14 pb-16 md:pt-20 md:pb-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          {phase === "beta" && (
            <p className="mb-5 inline-flex items-center gap-2 rounded-base border border-border bg-surface px-3 py-1 text-sm text-muted">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-accent"
              />
              {hero.badge}
            </p>
          )}

          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">{hero.title}</h1>
          <p className="mt-3 text-2xl text-accent md:text-3xl">{hero.tagline}</p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            {hero.description}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#testa"
              className="rounded-base bg-accent px-6 py-3 font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              {hero.primaryCta}
            </a>
            <a
              href="#funktioner"
              className="rounded-base border border-border px-6 py-3 font-medium transition-colors hover:bg-surface"
            >
              {hero.secondaryCta}
            </a>
          </div>
        </div>

        <div className="justify-self-center">
          <img
            src="/screenshots/start-screen.webp"
            alt="Startskärmen i Stigvidd med väder, hälsning och populära promenader nära dig"
            width={320}
            height={693}
            className="w-64 rounded-base border border-border shadow-2xl md:w-80"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
