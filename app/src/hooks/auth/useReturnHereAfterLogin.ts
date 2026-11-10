// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { loginReturnPathAtom } from "@/atoms/auth-atoms";
import { usePathname } from "expo-router";
import { useStore } from "jotai";

// Marks the current screen as where a successful login lands. keep-comment: pass as NotAuthenticatedDialog's onBeforeNavigate
export function useReturnHereAfterLogin() {
  const pathname = usePathname();
  const store = useStore();
  return () => store.set(loginReturnPathAtom, pathname);
}
