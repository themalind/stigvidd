<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: MPL-2.0
-->

# Licence — Stigvidd mobile app

The mobile app in this directory (Android and iOS, one codebase) is licensed under the
**Mozilla Public License, v. 2.0**. The full text is in
[`../LICENSES/MPL-2.0.txt`](../LICENSES/MPL-2.0.txt).

The rest of the repository — the backend API and the admin web — is licensed under the
**GNU Affero General Public License, version 3 or later**. See [`../README.md`](../README.md).

## Exhibit B is deliberately not applied

Nothing in `app/` carries MPL-2.0's Exhibit B _"Incompatible With Secondary Licenses"_
notice, and **nothing in `app/` ever should**. That omission is a licensing decision, not
an oversight.

Because it is omitted, the Secondary Licenses defined in MPL-2.0 § 1.12 remain available:
the **GNU GPL v2.0**, the **GNU LGPL v2.1**, the **GNU AGPL v3.0**, _or any later versions
of those licences_. Anyone who wants this code under strong copyleft may take it under
GPL-3.0-or-later or AGPL-3.0-or-later instead, and combine it into a Larger Work on those
terms (MPL-2.0 § 3.3). The AGPL text is already in the repository at
[`../LICENSES/AGPL-3.0-or-later.txt`](../LICENSES/AGPL-3.0-or-later.txt); the GNU licences
are also at <https://www.gnu.org/licenses/>.

**If you add an Exhibit B notice to any file here, you remove that option for everyone
downstream.** Don't.

## Why the app is not AGPL, when the backend is

The app ships to the Apple App Store, and Apple's terms impose FairPlay DRM and limit
installs to a bounded number of devices per account. GPLv3 and AGPLv3 § 6 forbid imposing
restrictions of that kind on a recipient, so distributing a (A)GPL-licensed binary through
the App Store is a licence violation — the conflict VLC hit, and the reason the VideoLAN
iOS port moved off the GPL.

MPL-2.0 has no anti-Tivoization clause and no equivalent "no further restrictions" term, so
it is compatible with store distribution. Keeping the Secondary Licenses available is what
stops that pragmatic choice from being a one-way ratchet away from copyleft.

Android and iOS are built from this one codebase, so the licence has to satisfy the stricter
of the two channels. That is Apple.

## Linking against proprietary platform components

Release builds link Google's Firebase Cloud Messaging and Google Play Services Location on
Android, and Apple's frameworks and APNs on iOS. MPL-2.0's copyleft is per-file and places
no condition on what the covered files may be combined with, so this raises none of the
linking questions that GPLv3 § 6 would have.

## Third-party components

The app bundles third-party code and a font under their own terms. See
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
