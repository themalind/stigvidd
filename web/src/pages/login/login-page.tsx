// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { LoginCard } from "@/components/login/login-card";

// The three legal pages are static files served by the PUBLIC site (site/public/), not
// by this image and not by any route here — so they need a plain <a> with an absolute
// URL. A relative href would 404 once the admin moves off the apex domain, and
// react-router's <Link> would match no route and render NotFoundPage without ever
// asking a server. The trailing slash avoids nginx's 301, and the paths are permanent:
// app/src/constants/constants.ts hardcodes them into the shipped app.
// See docs/notes/web-public-is-already-live.md.
const SITE_URL = "https://stigvidd.se";

const LEGAL_LINKS = [
  { href: `${SITE_URL}/privacy-policy/`, label: "Integritetspolicy" },
  { href: `${SITE_URL}/terms-of-use/`, label: "Användarvillkor" },
  { href: `${SITE_URL}/delete-account/`, label: "Radera konto" },
];

export default function LoginPage() {
  return (
    <main className="flex flex-col h-full bg-background">
      <div className="flex justify-end">
        <DarkModeToggle />
      </div>
      <div className="flex flex-1 flex-col justify-center items-center">
        <div className="flex items-center pr-5 pb-10">
          <div className="aspect-square max-w-40">
            <img src="/icon.png" alt="Stigvidd" />
          </div>
          <div>
            <h1 className="text-foreground text-4xl pt-4">Stigvidd</h1>
          </div>
        </div>
        <LoginCard />
      </div>

      <footer className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 px-4 py-6 text-sm text-muted-foreground">
        {LEGAL_LINKS.map((link, index) => (
          <span key={link.href} className="flex items-center gap-x-3">
            {index > 0 && <span aria-hidden="true">·</span>}
            <a
              href={link.href}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {link.label}
            </a>
          </span>
        ))}
      </footer>
    </main>
  );
}
