// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getUserToken } from "@/api/users";
import { logger } from "@/services/logger";
import { API_REQUEST_TIMEOUT_MS, apiFetch, BASE_URL, UPLOAD_TIMEOUT_MS } from "./api-config";
import { apiErrorFrom, isApiStatus } from "./api-error";

// "required" refuses without a token, "optional" sends one when signed in, "none" never sends one.
export type ApiAuth = "required" | "optional" | "none";

export interface ApiCall {
  name: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  // The route with its parameters as {param}, for the log. keep-comment: keeps identifiers out of the logs
  endpoint: string;
  body?: unknown;
  form?: FormData;
  auth?: ApiAuth;
  // Defaults to the upload timeout for multipart and the normal one otherwise.
  timeoutMs?: number;
  // Statuses the caller handles itself, so they are not logged as failures.
  quietStatuses?: number[];
}

async function authHeader(auth: ApiAuth): Promise<Record<string, string>> {
  if (auth === "none") return {};

  const token = await getUserToken();
  if (!token && auth === "required") {
    throw new Error("User not authenticated");
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
}

// One API request: token, JSON or multipart, a coded ApiError on failure, and one log line. keep-comment: shared by the api modules
export async function send(call: ApiCall): Promise<Response> {
  const method = call.method ?? "GET";

  try {
    const headers = await authHeader(call.auth ?? "required");
    if (call.form === undefined) headers["Content-Type"] = "application/json";

    const response = await apiFetch(
      `${BASE_URL}${call.path}`,
      {
        method,
        headers,
        body: call.form ?? (call.body === undefined ? undefined : JSON.stringify(call.body)),
      },
      call.timeoutMs ?? (call.form === undefined ? API_REQUEST_TIMEOUT_MS : UPLOAD_TIMEOUT_MS),
    );

    if (!response.ok) {
      throw await apiErrorFrom(response, `HTTP error: ${call.name}: ${response.status}`);
    }

    return response;
  } catch (error) {
    if (!call.quietStatuses?.some((status) => isApiStatus(error, status))) {
      logger.error(`${call.name} failed`, {
        endpoint: `${method} ${call.endpoint}`,
        errorMessage: String(error),
      });
    }
    throw error;
  }
}

export async function sendForJson<T>(call: ApiCall): Promise<T> {
  const response = await send(call);
  return (await response.json()) as T;
}

export function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}
