// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getValidAccessToken } from "@/services/keycloak-auth";

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
async function errorMessage(response: Response): Promise<string> {
  const fallback = `HTTP error ${response.status}`;
  const text = await response.text().catch(() => "");

  if (!text) return fallback;

  try {
    const body: unknown = JSON.parse(text);

    if (typeof body === "string") return body || fallback;

    if (body && typeof body === "object") {
      const { message, detail, title } = body as Record<string, unknown>;
      const named = [message, detail, title].find(
        (value) => typeof value === "string" && value.length > 0,
      );
      if (named) return named as string;
    }
  } catch {
    // Not JSON — the raw body is the best there is.
  }

  return text.slice(0, 300) || fallback;
}

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const token = await getValidAccessToken();
  const requestUrl = `${import.meta.env.VITE_API_URL}${url}`;

  const response = await fetch(requestUrl, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  // 204/205/304 carry no body; everything else is JSON from the API.
  const body = [204, 205, 304].includes(response.status)
    ? null
    : await response.text();

  return (body ? JSON.parse(body) : undefined) as T;
};
