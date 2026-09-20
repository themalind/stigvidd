<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# site — the public Stigvidd site

What a visitor to **stigvidd.se** gets: the landing page, and the three legal pages the
mobile app links to. Separate from [`web/`](../web), which is the **admin** UI on its own
hostname — this project has no API client, no Keycloak, no auth and no `VITE_*` build
args, and that is the point. It is static files and nothing else.

```sh
npm ci
npm run lint
npm test          # vitest run
npm run build     # tsc -b && vite build — this IS the type check
```

The Vite dev server is `npm run dev`; never run it in the foreground
(`.claude/hooks/guard-long-running.mjs` denies it).

## Where the words live

[`src/content/site-content.ts`](src/content/site-content.ts) holds every word on the page.
The product description and tagline are **copied from the app** —
`app/src/i18n/locales/sv.json`, key `about` — so the site and the About screen describe the
same product. Nothing checks that they still agree; when one changes, change the other.

The feature list is that file's `about.features`, one card per entry and in the same order.
Three entries were added to it when this site was built — the areas browser, the trail
randomiser and the nature guide — all real features the About screen had simply never
listed. The app side guards the count (`about-screen.test.tsx` asserts ten bullets); this
side has no such guard, so keep the two in step by hand.

`phase` in that file is what turns this from a tester page into a launch page. In `"beta"`
the install section recruits testers; set it to `"public"` and fill in `installLinks` and
it shows store buttons instead. No component changes.

While `installLinks` is empty the install section shows only the mail invitation, and the
store buttons appear by themselves once a link is filled in. The `.todo` class is still in
[`src/index.css`](src/index.css) for anything left unfinished — a red block on the live
page is the only draft marker in this repo that has ever worked, and everything under
`public/` is published by the next merge to `main`. See
[docs/notes/web-public-is-already-live.md](../docs/notes/web-public-is-already-live.md).

## One radius, and it comes from the app

`app/src/constants/constants.ts` declares `BORDER_RADIUS = 5` — one small value, aliased to
`SURFACE_BORDER_RADIUS` and `DIALOG_BORDER_RADIUS`, used in 261 places. It is not a scale,
and the site follows it: `--radius-base: 5px` in
[`src/index.css`](src/index.css), used as `rounded-base`.

That file also does `--radius-*: initial`, which **deletes Tailwind's default radius
scale**. `rounded-2xl` and friends then generate no CSS at all, so a pill button or a soft
card comes out square and visibly wrong instead of quietly drifting in. `--radius-full` is
defined back, for things that are genuinely circles.

Nothing checks the two files against each other. If `BORDER_RADIUS` changes, change this too.

## The legal pages are files, not routes

`public/{privacy-policy,terms-of-use,delete-account}/index.html` are hand-written,
bilingual, and served as **directories**. Three things follow:

1. Link them with a plain `<a href>`, never a client-side router.
2. **The trailing slash is load-bearing.** `/privacy-policy/` is 200; `/privacy-policy` is
   a 301 to the slashed form, which is why `nginx.conf` sets `absolute_redirect off` — the
   default builds that redirect from the scheme *inside* the container and would bounce a
   TLS visitor back to plain http.
3. **The paths are permanent.** `app/src/constants/constants.ts` hardcodes the absolute
   URLs into the shipped app, and `web/src/pages/login/login-page.tsx` links them too.

Everything under `public/` is published by the next merge to `main`, with no opt-in.

## Screenshots

`public/screenshots/*.webp` are downscaled from the full-size originals in
[`screenshots/`](../screenshots) at the repo root (1080×2340 JPEGs, ~1 MB each) to 640 px
WebP, ~40–140 KB. Re-do it with any image tool when the app's screens change; the
originals stay where they are.
