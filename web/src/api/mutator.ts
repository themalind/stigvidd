// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getValidAccessToken } from "@/lib/keycloak-auth";
import { logger } from "@/lib/telemetry";

/**
 * Single request choke point for the orval-generated API client (see
 * `orval.config.ts`). Reproduces the two conventions the hand-written `fetch`
 * wrappers relied on: the base URL comes from `VITE_API_URL`, and a Keycloak
 * bearer token is attached when a session exists (`getValidAccessToken` returns
 * `null` when signed out, so anonymous GETs still work).
 *
 * The generated client is configured with `includeHttpResponseReturnType: false`,
 * so this returns the parsed response body directly as `T`.
 */
/**
 * The API answers a refused request with the reason — a bare JSON string from
 * `ToActionResult`, or a ProblemDetails object when model binding rejected the body.
 * Both are worth showing; the status code on its own tells the operator nothing.
 */
async function readError(response: Response): Promise<{ message: string; code?: string }> {
  const fallback = `HTTP error ${response.status}`;
  const text = await response.text().catch(() => "");

  if (!text) return { message: fallback };

  try {
    const body: unknown = JSON.parse(text);

    if (typeof body === "string") return { message: body || fallback };

    if (body && typeof body === "object") {
      const { message, detail, title, code } = body as Record<string, unknown>;
      const named = [message, detail, title].find((value) => typeof value === "string" && value.length > 0);
      const coded = typeof code === "string" ? code : undefined;
      if (named) return { message: named as string, code: coded };
      if (coded) return { message: text.slice(0, 300), code: coded };
    }
  } catch {
    // Not JSON — the raw body is the best there is.
  }

  return { message: text.slice(0, 300) || fallback };
}

// keep-comment: code is set when the API answers with a coded ProblemDetails, so the UI can branch on the reason rather than its wording
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type ApiRequest = { method: string; endpoint: string };

export function describeRequest(path: string, method: string | undefined): ApiRequest {
  const query = path.search(/[?#]/);

  // The query string can carry coordinates, search terms or one-time codes. keep-comment: GDPR reason the path is cut
  return { method: (method ?? "GET").toUpperCase(), endpoint: query === -1 ? path : path.slice(0, query) };
}

export function logRefused(request: ApiRequest, status: number, message: string): void {
  const context = { ...request, status, errorMessage: message.slice(0, 300) };

  if (status >= 500) logger.error("API request failed", context);
  else logger.warn("API request failed", context);
}

export function logUnanswered(request: ApiRequest, error: unknown, signal?: AbortSignal | null): void {
  // React Query aborts on unmount and key change; that is not a failure. keep-comment: why aborts are not logged
  if (signal?.aborted) return;

  logger.error("API request failed", { ...request, errorMessage: String(error) });
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const token = await getValidAccessToken();
  const requestUrl = `${import.meta.env.VITE_API_URL}${url}`;
  const request = describeRequest(url, options.method);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    logUnanswered(request, error, options.signal);
    throw error;
  }

  if (!response.ok) {
    const { message, code } = await readError(response);
    logRefused(request, response.status, message);
    throw new ApiError(message, response.status, code);
  }

  // 204/205/304 carry no body; everything else is JSON from the API.
  const body = [204, 205, 304].includes(response.status) ? null : await response.text();

  return (body ? JSON.parse(body) : undefined) as T;
};
