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
    throw new Error(`HTTP error ${response.status}`);
  }

  // 204/205/304 carry no body; everything else is JSON from the API.
  const body = [204, 205, 304].includes(response.status)
    ? null
    : await response.text();

  return (body ? JSON.parse(body) : undefined) as T;
};
