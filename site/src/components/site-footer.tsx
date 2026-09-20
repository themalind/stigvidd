// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { contactEmail, footer } from "@/content/site-content";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">Stigvidd</p>
          <p className="mt-1 text-sm text-muted">{footer.tagline}</p>
        </div>

        <nav aria-label="Om och villkor" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {/*
            Plain anchors on purpose. These are FILES under public/, not routes — the
            trailing slash is load-bearing and a client-side router would render a 404
            without ever asking the server. See docs/notes/web-public-is-already-live.md.
          */}
          {footer.legal.map((link) => (
            <a key={link.href} href={link.href} className="text-muted hover:text-text">
              {link.label}
            </a>
          ))}
          <a href={`mailto:${contactEmail}`} className="text-muted hover:text-text">
            Kontakt
          </a>
          <a
            href={footer.sourceUrl}
            className="text-muted hover:text-text"
            rel="noreferrer"
            target="_blank"
          >
            Källkod
          </a>
        </nav>
      </div>
    </footer>
  );
}
