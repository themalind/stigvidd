// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { logger } from "@/services/logger";
import { apiFetch, BASE_URL, UPLOAD_TIMEOUT_MS } from "./api-config";
import { apiErrorFrom } from "./api-error";
import { getUserToken } from "./users";

export interface AuthedCall {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  // The route with its parameters as {param}, for the log. keep-comment: keeps identifiers out of the logs
  endpoint: string;
  body?: unknown;
  form?: FormData;
}

// A signed-in request: JSON or multipart, a coded ApiError on failure, and one log line. keep-comment: shared by the api modules
export async function sendAuthed(call: AuthedCall): Promise<Response> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (call.form === undefined) headers["Content-Type"] = "application/json";

    const response = await apiFetch(
      `${BASE_URL}${call.path}`,
      {
        method: call.method,
        headers,
        body: call.form ?? (call.body === undefined ? undefined : JSON.stringify(call.body)),
      },
      call.form === undefined ? undefined : UPLOAD_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw await apiErrorFrom(response, `HTTP error: ${call.name}: ${response.status}`);
    }

    return response;
  } catch (error) {
    logger.error(`${call.name} failed`, {
      endpoint: `${call.method} ${call.endpoint}`,
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function sendAuthedForJson<T>(call: AuthedCall): Promise<T> {
  const response = await sendAuthed(call);
  return (await response.json()) as T;
}

export function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}
