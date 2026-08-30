// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "react-router";
import iconUrl from "../../assets/icon.png";
import CommingSoonImages from "./comming-soon-images";

// The three legal pages are hand-written static files in web/public/, copied
// verbatim into dist/ by Vite and served by nginx — they are NOT routes in
// router.tsx. So they must be reached with a plain <a>: react-router's <Link>
// would handle the click client-side, find no matching route and render
// NotFoundPage instead of ever asking the server for the file.
//
// The paths are permanent. They are registered in Play Console and App Store
// Connect and hard-coded in app/src/constants/constants.ts; the trailing slash
// matters, since without it nginx answers with a 301 first.
//
// See docs/notes/web-public-is-already-live.md.
const LEGAL_LINKS = [
  { href: "/privacy-policy/", label: "Integritetspolicy" },
  { href: "/terms-of-use/", label: "Användarvillkor" },
  { href: "/delete-account/", label: "Radera konto" },
];

export default function CommingSoonPage() {
  return (
    <div className="h-full flex flex-col bg-stone-900">
      <div className="flex-1 flex justify-center items-center gap-4">
        <div className="flex flex-col items-center lg:gap-10 lg:flex-row lg:items-stretch">
          <div
            className="flex flex-col justify-center w-2xs pb-4
                   items-center text-center
                   lg:items-start lg:text-left lg:order-last"
          >
            <Link to={"/login"}>
              <div className="flex items-center mb-3">
                <div className="w-20 aspect-square rounded-full overflow-hidden">
                  <img src={iconUrl} alt="Stigvidd Logo" />
                </div>
                <div className="pl-3">
                  <h1 className="text-3xl text-stone-200">Stigvidd</h1>
                </div>
              </div>
            </Link>

            <div className="text-stone-200">
              <p>Kommer snart!</p>
            </div>
          </div>

          <CommingSoonImages />
        </div>
      </div>

      <footer className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 px-4 py-6 text-sm text-stone-400">
        {LEGAL_LINKS.map((link, index) => (
          <span key={link.href} className="flex items-center gap-x-3">
            {index > 0 && <span aria-hidden="true">·</span>}
            <a
              href={link.href}
              className="underline underline-offset-4 hover:text-stone-200"
            >
              {link.label}
            </a>
          </span>
        ))}
      </footer>
    </div>
  );
}
