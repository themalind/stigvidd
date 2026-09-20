// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Apple, Mail, Smartphone } from "lucide-react";
import { contactEmail, install, installLinks } from "@/content/site-content";
import { detectPlatform, orderedPlatforms, type Platform } from "@/lib/install-links";

const LABELS = {
  ios: { label: "Hämta till iPhone", Icon: Apple },
  android: { label: "Hämta till Android", Icon: Smartphone },
} as const;

export default function InstallSection() {
  // Read once, at first render. This is a client-only bundle with no SSR, so the user
  // agent is already there and an effect would only add a second render.
  const [platform] = useState<Platform>(() => detectPlatform(navigator.userAgent));

  const available = orderedPlatforms(installLinks, platform);
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent("Jag vill testa Stigvidd")}`;

  return (
    <section id="testa" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {install.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">{install.body}</p>
        </div>

        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {install.steps.map((step, index) => (
            <li key={step.title} className="rounded-base border border-border bg-bg p-6">
              <span className="flex size-8 items-center justify-center rounded-base bg-accent font-semibold text-accent-contrast">
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a
            href={mailto}
            className="inline-flex items-center gap-2 rounded-base bg-accent px-6 py-3 font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            <Mail aria-hidden="true" className="size-5" />
            Mejla {contactEmail}
          </a>

          {available.map(({ platform: name, url }) => {
            const { label, Icon } = LABELS[name];
            return (
              <a
                key={name}
                href={url}
                className="inline-flex items-center gap-2 rounded-base border border-border bg-bg px-6 py-3 font-medium transition-colors hover:bg-surface"
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
