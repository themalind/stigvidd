# The licence is per-area, not repo-wide: `app/` is MPL-2.0 while the rest is AGPL

The root [`LICENSE`](../../LICENSE) is the AGPL, and GitHub's detector reports the repo as
AGPL-3.0. **That is the licence of two of the three areas, not of the repository.**

| area | licence | why |
| --- | --- | --- |
| `backend/` | AGPL-3.0-or-later | network server software — the case AGPL § 13 exists for |
| `web/` | AGPL-3.0-or-later | the other half of that one service; the bundle is conveyed to every visitor |
| `app/` | **MPL-2.0** | Android and iOS are one codebase, and Apple will not take (A)GPL |

## Why the app cannot be AGPL

Apple's App Store terms impose FairPlay DRM and limit installs to a bounded number of
devices per account. GPLv3/AGPLv3 § 6 forbids imposing further restrictions on a recipient,
so shipping an (A)GPL binary through the App Store is a licence violation — the conflict
that pushed VLC's iOS port off the GPL. Android and iOS build from the same `app/`, so the
licence has to satisfy the stricter channel.

## Exhibit B is omitted on purpose, and that omission is load-bearing

No file under `app/` carries MPL-2.0's Exhibit B *"Incompatible With Secondary Licenses"*
notice. Because it is absent, the Secondary Licenses of MPL-2.0 § 1.12 stay available —
GPL-2.0-or-later, LGPL-2.1-or-later, **AGPL-3.0-or-later** — so anyone who wants strong
copyleft can still take the code on those terms (§ 3.3). Adding an Exhibit B notice to any
file there would silently remove that option for everyone downstream. It reads like
boilerplate someone forgot; it is a decision. See [`app/LICENSE.md`](../../app/LICENSE.md).

This is also why `LICENSES/` holds no separate GPL text: MPL § 1.12 names the AGPL v3
explicitly, and that text is already there.

## How the declaration is attached, and what you must not edit

The repo follows [REUSE](https://reuse.software): every source file carries an
`SPDX-License-Identifier` header, and `reuse lint` is a CI job (`licensing` in
[ci.yml](../../.github/workflows/ci.yml)). Measured at the time of writing: 1011 of 1011
files covered.

Three groups deliberately carry **no** header and are declared in
[`REUSE.toml`](../../REUSE.toml) instead, because `guard-generated-files.mjs` denies the
edit and is right to — each accepts a header and discards it later:

- `web/src/api/generated/**` and `web/openapi.json` (orval / the test suite rewrite them),
- `backend/Infrastructure/Migrations/**` (EF owns the Designer and snapshot files; the 20
  migration bodies are all applied),
- every binary asset.

Two traps when sweeping headers across the tree:

- **196 of the 402 `.cs` files carry a UTF-8 BOM.** The BOM must remain the *first bytes* of
  the file, so a header goes **after** it, not before. Prepending blindly moves the BOM into
  the middle of the file.
- `.gitattributes` normalises everything to LF, so write LF — a CRLF header breaks
  `prettier --check` and the generated-client diff gate for reasons that look unrelated
  ([[line-endings-and-generated-files]]).

Copyright notices read `The Stigvidd Authors`, a convenience label with no legal effect;
the individual holders are in [`AUTHORS`](../../AUTHORS). There is no CLA, so **relicensing
any area needs the agreement of all of them**.

Related: [[fluentassertions-8-is-not-free-software]], [[openapi-contract-snapshot]].
