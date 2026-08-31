// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * telemetry.ts reads VITE_OO_LOGS_URL / VITE_OO_LOGS_TOKEN at MODULE LOAD, so every test
 * that needs different configuration has to stub the env and re-import — the same shape
 * keycloak-auth.test.ts uses, and for the same reason.
 *
 * The runner config sets both to "" for the whole suite, so the DEFAULT here is telemetry
 * off. That is deliberate: no test can reach a real observatory even on a developer's
 * machine whose own web/.env has working credentials.
 */
const LOGS_URL = "https://observatory.test/api/default/stigvidd_web_logs/_json";
const LOGS_TOKEN = "dGVzdC11c2VyOnRlc3QtcGFzc2NvZGU=";

type Telemetry = typeof import("./telemetry");

async function loadTelemetry(
  env: { url?: string; token?: string } = { url: LOGS_URL, token: LOGS_TOKEN },
): Promise<Telemetry> {
  vi.stubEnv("VITE_OO_LOGS_URL", env.url ?? "");
  vi.stubEnv("VITE_OO_LOGS_TOKEN", env.token ?? "");
  vi.resetModules();

  return import("./telemetry");
}

/** The body of the nth fetch call, parsed back out of the JSON it was sent as. */
function sentRecords(fetchMock: ReturnType<typeof vi.fn>, call = 0): unknown[] {
  const init = fetchMock.mock.calls[call][1] as RequestInit;

  return JSON.parse(init.body as string) as unknown[];
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
  // The module logs to the console unconditionally; keep the suite output readable.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("opt-in", () => {
  it("installs no sink and never fetches when neither variable is set", async () => {
    const telemetry = await loadTelemetry({});

    telemetry.initTelemetry();
    for (let i = 0; i < 50; i++) telemetry.logger.error("boom");
    await telemetry.flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("installs no sink when only the URL is set", async () => {
    // Half a pair is not a configuration — shipping to an endpoint with no credential would
    // be a 401 per batch, forever, silently.
    const telemetry = await loadTelemetry({ url: LOGS_URL });

    telemetry.initTelemetry();
    for (let i = 0; i < 50; i++) telemetry.logger.error("boom");
    await telemetry.flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still writes to the console when telemetry is off", async () => {
    const telemetry = await loadTelemetry({});

    telemetry.initTelemetry();
    telemetry.logger.error("boom");

    expect(console.error).toHaveBeenCalledWith("boom");
  });

  it("keeps debug lines out of the observatory but still on the console", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    for (let i = 0; i < 50; i++) telemetry.logger.debug("chatter");
    await telemetry.flush();

    // Highest volume, lowest value — and every line costs disk under a retention window
    // that is also a GDPR control.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("chatter");
  });

  it("still ships info and above", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    telemetry.logger.info("kept");
    telemetry.logger.warn("kept");
    telemetry.logger.error("kept");
    await telemetry.flush();

    expect(sentRecords(fetchMock)).toHaveLength(3);
  });

  it("buffers nothing until initTelemetry has run", async () => {
    const telemetry = await loadTelemetry();

    // Configured, but never initialised — e.g. a module imported by a test rather than by
    // main.tsx. Nothing should be queued behind the caller's back.
    for (let i = 0; i < 50; i++) telemetry.logger.error("boom");
    await telemetry.flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("shipping", () => {
  it("posts to the configured URL with the ingestion token as Basic auth", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    telemetry.logger.info("hello");
    await telemetry.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(LOGS_URL);
    expect(init.method).toBe("POST");
    // Passed through verbatim — the token is ALREADY base64("user:passcode"), and encoding
    // it a second time is a 401 that looks exactly like a wrong credential.
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${LOGS_TOKEN}`,
    );
  });

  it("sends _timestamp in microseconds, which is what OpenObserve stores", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));

    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    telemetry.logger.info("hello");
    await telemetry.flush();

    const [record] = sentRecords(fetchMock) as { _timestamp: number }[];

    // Milliseconds would be silently accepted and land the record in 1970, outside every
    // dashboard's window and outside ZO_INGEST_ALLOWED_UPTO.
    expect(record._timestamp).toBe(Date.UTC(2026, 7, 31, 12) * 1000);
  });

  it("flushes automatically once a batch fills, without waiting for the timer", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    for (let i = 0; i < 20; i++) telemetry.logger.info(`line ${i}`);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(sentRecords(fetchMock)).toHaveLength(20);
  });

  it("keeps a failed batch and retries it on the next flush", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });
    telemetry.logger.error("first");
    await telemetry.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    telemetry.logger.error("second");
    await telemetry.flush();

    // Both records, oldest first — a dropped batch loses exactly the incident that caused it.
    const retried = sentRecords(fetchMock, 1) as { message: string }[];

    expect(retried.map((r) => r.message)).toEqual(["first", "second"]);
  });

  it("never rejects when the network fails, so a caller cannot be broken by telemetry", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    telemetry.logger.error("boom");

    await expect(telemetry.flush()).resolves.toBeUndefined();
  });

  it("sets keepalive only for the page-hidden flush", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    telemetry.logger.info("ordinary");
    await telemetry.flush();
    telemetry.logger.info("leaving");
    await telemetry.flush(true);

    expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(false);
    expect((fetchMock.mock.calls[1][1] as RequestInit).keepalive).toBe(true);
  });
});

describe("redaction", () => {
  it("drops credential-bearing and location keys from context", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    telemetry.logger.error("save failed", {
      accessToken: "abc",
      refreshToken: "def",
      Authorization: "Basic xyz",
      latitude: 57.7089,
      longitude: 11.9746,
      geometry: "LINESTRING(...)",
      trailId: 42,
    });
    await telemetry.flush();

    const [record] = sentRecords(fetchMock) as Record<string, unknown>[];

    for (const key of [
      "accessToken",
      "refreshToken",
      "Authorization",
      "latitude",
      "longitude",
      "geometry",
    ]) {
      expect(record[key]).toBe("[redacted]");
    }

    // Non-identifying context is the whole point of shipping logs — it must survive.
    expect(record.trailId).toBe(42);
  });

  it("scrubs JWTs, bearer tokens, emails and coordinates out of the message itself", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    telemetry.logger.error(
      "failed for admin@stigvidd.se with Bearer eyJhbGciOi.eyJzdWIi.sig at 57.70887,11.97456",
    );
    await telemetry.flush();

    const [record] = sentRecords(fetchMock) as { message: string }[];

    expect(record.message).not.toContain("admin@stigvidd.se");
    expect(record.message).not.toContain("eyJhbGciOi");
    expect(record.message).not.toContain("57.70887");
    // The domain is kept — it distinguishes a staff account from a member without naming one.
    expect(record.message).toContain("***@stigvidd.se");
  });

  it("redacts inside nested context objects", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    telemetry.logger.error("nested", {
      request: { headers: { authorization: "Basic xyz" } },
    });
    await telemetry.flush();

    const [record] = sentRecords(fetchMock) as {
      request: { headers: { authorization: string } };
    }[];

    expect(record.request.headers.authorization).toBe("[redacted]");
  });

  it("does not let a context key shadow the record's own fields", async () => {
    const telemetry = await loadTelemetry();

    telemetry.initTelemetry();
    telemetry.logger.error("real message", { level: "debug", message: "spoofed" });
    await telemetry.flush();

    const [record] = sentRecords(fetchMock) as { level: string; message: string }[];

    expect(record.level).toBe("error");
    expect(record.message).toBe("real message");
  });
});
