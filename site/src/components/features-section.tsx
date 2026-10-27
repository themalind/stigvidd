// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  BookOpen,
  Compass,
  Dices,
  Footprints,
  Heart,
  MapPinned,
  Navigation,
  Send,
  Star,
  ThumbsUp,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { FeatureIcon, SiteContent } from "@/content/site-content";

// The content file names an icon; this is where a name becomes a component. Keeping the
// mapping here means site-content.ts stays plain data with no React import.
const ICONS: Record<FeatureIcon, LucideIcon> = {
  "map-pinned": MapPinned,
  navigation: Navigation,
  footprints: Footprints,
  star: Star,
  heart: Heart,
  "triangle-alert": TriangleAlert,
  users: Users,
  send: Send,
  "thumbs-up": ThumbsUp,
  compass: Compass,
  dices: Dices,
  "book-open": BookOpen,
};

export default function FeaturesSection({ title, features }: { title: string; features: SiteContent["features"] }) {
  return (
    <section id="funktioner" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = ICONS[feature.icon];
            return (
              <li key={feature.title} className="rounded-base border border-border bg-bg p-6">
                <Icon aria-hidden="true" className="size-6 text-accent" />
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
