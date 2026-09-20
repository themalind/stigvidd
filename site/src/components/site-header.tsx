// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { hero } from "@/content/site-content";

const NAV = [
  { href: "#funktioner", label: "Funktioner" },
  { href: "#bilder", label: "Bilder" },
  { href: "#testa", label: "Testa appen" },
  { href: "#fragor", label: "Frågor" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <a href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <img src="/icon.png" alt="" width={32} height={32} className="rounded-base" />
          <span>Stigvidd</span>
        </a>

        <nav aria-label="Huvudmeny" className="ml-auto hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted transition-colors hover:text-text"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href="#testa"
          className="ml-auto rounded-base bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 md:ml-0"
        >
          {hero.primaryCta}
        </a>
      </div>
    </header>
  );
}
