// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";

const getValidAccessToken = vi.hoisted(() => vi.fn<() => Promise<string | null>>());
vi.mock("@/services/keycloak-auth", () => ({ getValidAccessToken }));

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("@/services/telemetry", () => ({ logger }));

import { customFetch } from "./mutator";

/** A Response is easier to build by hand here than to fake: the code reads .text(). */
function reply(body: string | null, status = 200): Response {
  return new Response(body, { status });
}

function lastRequest() {
  return vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
}

describe("customFetch", () => {
  beforeEach(() => {
    getValidAccessToken.mockResolvedValue("a-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("{}")));
  });

  it("prefixes the path with VITE_API_URL", async () => {
    await customFetch("/api/trails", { method: "GET" });

    expect(lastRequest()[0]).toBe("https://api.test/api/trails");
  });

  it("attaches the Keycloak bearer token when there is a session", async () => {
    await customFetch("/api/trails", { method: "GET" });

    expect(lastRequest()[1].headers).toMatchObject({
      Authorization: "Bearer a-token",
    });
  });

  it("sends no Authorization header when signed out, so anonymous GETs still work", async () => {
    getValidAccessToken.mockResolvedValue(null);

    await customFetch("/api/trails", { method: "GET" });

    expect(lastRequest()[1].headers).not.toHaveProperty("Authorization");
  });

  it("keeps the caller's own headers", async () => {
    await customFetch("/api/trails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(lastRequest()[1].headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer a-token",
    });
  });

  it("parses the JSON body", async () => {
    vi.mocked(fetch).mockResolvedValue(reply('{"identifier":"abc"}'));

    await expect(customFetch("/api/trails/abc", {})).resolves.toEqual({
      identifier: "abc",
    });
  });

  it("returns undefined for a 204, which carries no body", async () => {
    vi.mocked(fetch).mockResolvedValue(reply(null, 204));

    await expect(customFetch("/api/trails/abc", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("returns undefined for a 205", async () => {
    vi.mocked(fetch).mockResolvedValue(reply(null, 205));

    await expect(customFetch("/api/x", {})).resolves.toBeUndefined();
  });

  // 304 is in the no-body list in mutator.ts but never reaches it: Response.ok is
  // false outside 200-299, so a 304 throws first. Asserted so the day that changes
  // is a red test rather than a silent one.
  it("treats a 304 as an error, not as an empty body", async () => {
    vi.mocked(fetch).mockResolvedValue(reply(null, 304));

    await expect(customFetch("/api/x", {})).rejects.toThrow("HTTP error 304");
  });

  describe("the error it throws", () => {
    it("uses a bare JSON string, which is what ToActionResult returns", async () => {
      vi.mocked(fetch).mockResolvedValue(reply('"Trail is already linked"', 409));

      await expect(customFetch("/api/x", {})).rejects.toThrow("Trail is already linked");
    });

    it("uses ProblemDetails.title when that is the only name present", async () => {
      vi.mocked(fetch).mockResolvedValue(reply('{"title":"One or more validation errors occurred."}', 400));

      await expect(customFetch("/api/x", {})).rejects.toThrow("One or more validation errors occurred.");
    });

    it("prefers message over detail and title", async () => {
      vi.mocked(fetch).mockResolvedValue(reply('{"title":"t","detail":"d","message":"m"}', 400));

      await expect(customFetch("/api/x", {})).rejects.toThrow("m");
    });

    it("prefers detail over title", async () => {
      vi.mocked(fetch).mockResolvedValue(reply('{"title":"t","detail":"d"}', 400));

      await expect(customFetch("/api/x", {})).rejects.toThrow("d");
    });

    // A ValidationProblemDetails carries its reasons under `errors`, which the name
    // list does not look at — so the operator is shown the raw JSON.
    it("shows the raw JSON when it parses but names nothing", async () => {
      vi.mocked(fetch).mockResolvedValue(reply('{"errors":{"Name":["req"]}}', 400));

      await expect(customFetch("/api/x", {})).rejects.toThrow('{"errors":{"Name":["req"]}}');
    });

    it("falls back to the status on an empty body", async () => {
      vi.mocked(fetch).mockResolvedValue(reply("", 500));

      await expect(customFetch("/api/x", {})).rejects.toThrow("HTTP error 500");
    });

    it("shows a non-JSON body, capped so an HTML error page cannot fill the toast", async () => {
      vi.mocked(fetch).mockResolvedValue(reply("<html>".repeat(200), 502));

      const error = await customFetch("/api/x", {}).catch((e: Error) => e);

      expect((error as Error).message).toHaveLength(300);
    });
  });

  describe("logging a failed request", () => {
    beforeEach(() => {
      Object.values(logger).forEach((log) => log.mockClear());
    });

    it("logs a refusal as a warning, with the path but never the query string or the token", async () => {
      vi.mocked(fetch).mockResolvedValue(reply('"Not yours"', 403));

      await expect(
        customFetch("/api/v1/admin/media?near=57.70887,11.97456&q=someone", { method: "get" }),
      ).rejects.toThrowError(/^Not yours$/);

      expect(logger.warn).toHaveBeenCalledExactlyOnceWith("API request failed", {
        method: "GET",
        endpoint: "/api/v1/admin/media",
        status: 403,
        errorMessage: "Not yours",
      });
      expect(logger.error).not.toHaveBeenCalled();

      const logged = JSON.stringify(logger.warn.mock.calls);
      expect(logged).not.toContain("57.70887");
      expect(logged).not.toContain("someone");
      expect(logged).not.toContain("a-token");
    });

    it("logs a server failure as an error", async () => {
      vi.mocked(fetch).mockResolvedValue(reply("", 500));

      await expect(customFetch("/api/v1/admin/trails/abc", { method: "PUT" })).rejects.toThrowError(/^HTTP error 500$/);

      expect(logger.error).toHaveBeenCalledExactlyOnceWith("API request failed", {
        method: "PUT",
        endpoint: "/api/v1/admin/trails/abc",
        status: 500,
        errorMessage: "HTTP error 500",
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("logs a request that got no answer, then rethrows the very same error", async () => {
      const offline = new TypeError("Failed to fetch");
      vi.mocked(fetch).mockRejectedValue(offline);

      await expect(customFetch("/api/v1/admin/facilities?page=2", { method: "POST" })).rejects.toBe(offline);

      expect(logger.error).toHaveBeenCalledExactlyOnceWith("API request failed", {
        method: "POST",
        endpoint: "/api/v1/admin/facilities",
        errorMessage: "TypeError: Failed to fetch",
      });
    });

    it("does not log a request the caller cancelled", async () => {
      const controller = new AbortController();
      controller.abort();
      vi.mocked(fetch).mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

      await expect(customFetch("/api/v1/admin/media", { signal: controller.signal })).rejects.toThrow("aborted");

      expect(logger.error).not.toHaveBeenCalled();
    });

    it("logs nothing for a request that succeeded", async () => {
      await customFetch("/api/v1/admin/media", {});

      Object.values(logger).forEach((log) => expect(log).not.toHaveBeenCalled());
    });
  });
});
