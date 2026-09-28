// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { withTimeout } from "@/services/with-timeout";

export const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}`;

export const API_REQUEST_TIMEOUT_MS = 30_000;
export const UPLOAD_TIMEOUT_MS = 120_000;

// Android's OkHttp never times out; the bound covers the response headers, not the body. keep-comment: hidden platform constraint
export function apiFetch(url: string, init: RequestInit = {}, timeoutMs = API_REQUEST_TIMEOUT_MS): Promise<Response> {
  return withTimeout((signal) => fetch(url, { ...init, signal }), timeoutMs, "API request timed out");
}
