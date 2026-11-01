// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Matches https://link.stigvidd.se/<kind>/<id> and stigvidd://<kind>/<id>. keep-comment: the two shapes a shared link arrives in
const SHARED_LINK = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^/]*\/)?(trail|event)\/([^/?#]+)/i;

// Several tabs have trail/ and event/ routes, so a bare /trail/<id> or /event/<id> would land in whichever expo-router picks. keep-comment: why the rewrite exists
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const link = SHARED_LINK.exec(path);
  if (!link) return path;
  const kind = link[1].toLowerCase();
  return `/${kind}s/${kind}/${link[2]}`;
}
