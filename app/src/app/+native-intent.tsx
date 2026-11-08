// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { router } from "expo-router";

// Matches https://link.stigvidd.se/<kind>/<id> and stigvidd://<kind>/<id>. keep-comment: the two shapes a shared link arrives in
const SHARED_LINK = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^/]*\/)?(trail|event)\/([^/?#]+)/i;

// Several tabs have trail/ and event/ routes, so a bare /trail/<id> or /event/<id> would land in whichever expo-router picks. keep-comment: why the rewrite exists
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  const link = SHARED_LINK.exec(path);
  if (!link) return path;
  const kind = link[1].toLowerCase();
  const target = `/${kind}s/${kind}/${link[2]}`;
  if (initial) return target;
  // expo-router opens a running app's links without the anchor, which leaves back without the tab's list; singular so a second link replaces the first. keep-comment: SDK 58's useLinking listener passes no withAnchor
  router.navigate(target as never, { withAnchor: true, dangerouslySingular: (name) => name });
  return null;
}
