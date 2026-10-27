// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Matches https://link.stigvidd.se/trail/<id> and stigvidd://trail/<id>. keep-comment: the two shapes a shared link arrives in
const TRAIL_LINK = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^/]*\/)?trail\/([^/?#]+)/i;

// Four tabs have a trail/[identifier] route, so a bare /trail/<id> would land in whichever expo-router picks. keep-comment: why the rewrite exists
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const match = TRAIL_LINK.exec(path);
  return match ? `/trails/trail/${match[1]}` : path;
}
