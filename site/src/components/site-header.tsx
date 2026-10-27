// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Globe } from "lucide-react";
import type { SiteContent } from "@/content/site-content";

export default function SiteHeader({ header, cta }: { header: SiteContent["header"]; cta: string }) {
  const other = header.otherLanguage;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <a href={header.home} className="flex items-center gap-2.5 font-semibold tracking-tight">
          <img src="/icon.png" alt="" width={32} height={32} className="rounded-base" />
          <span>Stigvidd</span>
        </a>

        <nav aria-label={header.navLabel} className="ml-auto hidden items-center gap-6 md:flex">
          {header.nav.map((item) => (
            <a key={item.href} href={item.href} className="text-sm text-muted transition-colors hover:text-text">
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href="#hamta"
          className="ml-auto rounded-base bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 md:ml-0"
        >
          {cta}
        </a>

        <a
          href={other.href}
          hrefLang={other.lang}
          lang={other.lang}
          className="flex items-center gap-1.5 rounded-base border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-surface"
        >
          <Globe aria-hidden="true" className="size-4" />
          <span className="sr-only sm:not-sr-only">{other.label}</span>
        </a>
      </div>
    </header>
  );
}
