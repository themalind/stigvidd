// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { atom } from "jotai";
import { type AuthUser } from "@/data/types";

/**
 * Atom that holds the current authenticated user
 * null = not authenticated
 * AuthUser = authenticated user object (derived from the Keycloak token)
 */
export const userAtom = atom<AuthUser | null>(null);

/**
 * True while the initial session restore (loadTokens + refresh) is in flight.
 * Gates the first render so there is no auth-resolution blink at startup.
 */
export const authLoadingAtom = atom<boolean>(true);
