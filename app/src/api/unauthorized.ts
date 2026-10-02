// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { handleUnauthorized, SessionUnavailableError } from "@/services/keycloak-auth";
import { onlineManager } from "@tanstack/react-query";
import { ApiError } from "./api-error";

const MAX_RETRIES = 3;

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function retryUnlessAuthFailure(failureCount: number, error: unknown): boolean {
  if (isUnauthorized(error) || error instanceof SessionUnavailableError) return false;
  // Offline every attempt fails the same way; the reconnect refetches instead.
  if (!onlineManager.isOnline()) return false;
  return failureCount < MAX_RETRIES;
}

export async function withUnauthorizedRetry<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!isUnauthorized(error) || (await handleUnauthorized()) !== "refreshed") throw error;
    return request();
  }
}
