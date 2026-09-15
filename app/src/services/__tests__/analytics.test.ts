// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// These are the consent rules in executable form. docs/observability.md states that analytics
// need prior opt-in consent while error logging rides on legitimate interest; the test named
// "an error log still ships while analytics consent is denied" is the half that keeps those two
// separable, and is the single most important assertion in this file.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { track, setEventSink, flushEvents, resetAnalytics, analyticsBufferSizes } from "@/services/analytics";
import { resetConsent, setConsent, loadConsent } from "@/services/consent";
import { logger, resetLogger, setLogSink, flush } from "@/services/logger";
import type { EventName } from "@/services/event-catalogue";

type Sent = Record<string, unknown>[];

function sinkCapturing(sent: Sent[]) {
  return jest.fn(async (events: Record<string, unknown>[]) => {
    sent.push(events);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetAnalytics();
  resetConsent();
  resetLogger();
  await AsyncStorage.clear();
});

afterEach(() => {
  resetAnalytics();
  resetConsent();
  resetLogger();
});

describe("consent gating", () => {
  it("transmits nothing while the choice is still unknown", async () => {
    const sent: Sent[] = [];
    const sink = sinkCapturing(sent);
    setEventSink(sink);

    track("consent.granted", {});
    await flushEvents();

    expect(sink).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
    // Held, not dropped — a later grant must be able to release it.
    expect(analyticsBufferSizes().pending).toBe(1);
  });

  it("releases what was held when consent is granted", async () => {
    const sent: Sent[] = [];
    setEventSink(sinkCapturing(sent));

    track("consent.granted", {});
    expect(analyticsBufferSizes().pending).toBe(1);

    await setConsent("granted");
    await flushEvents();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(1);
    expect(sent[0][0]).toMatchObject({ event: "consent.granted" });
  });

  it("DISCARDS what was held when consent is declined, rather than keeping it for later", async () => {
    const sent: Sent[] = [];
    setEventSink(sinkCapturing(sent));

    track("consent.granted", {});
    expect(analyticsBufferSizes().pending).toBe(1);

    await setConsent("denied");

    expect(analyticsBufferSizes()).toEqual({ pending: 0, buffered: 0 });

    // And a later change of heart must not resurrect them.
    await setConsent("granted");
    await flushEvents();

    expect(sent).toHaveLength(0);
  });

  it("drops a later event at the door once consent is denied", async () => {
    const sent: Sent[] = [];
    setEventSink(sinkCapturing(sent));
    await setConsent("denied");

    track("hike.recording_started", { engine: "expo_task", backgroundPermission: "granted" });

    // Nothing is buffered at all: the gate is in track(), not in flushEvents(). If the check
    // moved to flush time this would hold a declined user's event in memory.
    expect(analyticsBufferSizes()).toEqual({ pending: 0, buffered: 0 });

    await flushEvents();
    expect(sent).toHaveLength(0);
  });

  it("stops transmitting after consent is revoked mid-session", async () => {
    const sent: Sent[] = [];
    setEventSink(sinkCapturing(sent));
    await setConsent("granted");

    await setConsent("denied");
    track("consent.granted", {});
    await flushEvents();

    expect(sent).toHaveLength(0);
  });

  it("honours a stored decline from a previous launch", async () => {
    await AsyncStorage.setItem("@stigvidd_rum_consent", "denied");
    await loadConsent();

    const sent: Sent[] = [];
    setEventSink(sinkCapturing(sent));

    track("consent.granted", {});
    await flushEvents();

    expect(sent).toHaveLength(0);
  });
});

describe("separability from the error safety net", () => {
  // THE load-bearing test. Consent gates analytics; it must not gate crash and error logging,
  // which is defensible on legitimate interest and is what keeps the app debuggable for a user
  // who declined. Route logger.error through the consent gate and this goes red.
  it("still ships an error log while analytics consent is denied", async () => {
    const logged: unknown[] = [];
    setLogSink((records) => {
      logged.push(...records);
    });

    const sent: Sent[] = [];
    setEventSink(sinkCapturing(sent));
    await setConsent("denied");

    logger.error("Something broke", { errorMessage: "boom" });
    track("consent.granted", {});

    await flush();
    await flushEvents();

    expect(sent).toHaveLength(0);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ level: "error", message: "Something broke" });
  });
});

describe("what leaves the device", () => {
  async function sendAndCapture(event: EventName, props: Record<string, unknown>): Promise<Record<string, unknown>> {
    const sent: Sent[] = [];
    setEventSink(sinkCapturing(sent));
    await setConsent("granted");

    // Cast: this helper is deliberately loose so one body can drive several event shapes,
    // including the deliberately-invalid properties the redaction tests pass.
    (track as (e: EventName, p: Record<string, unknown>) => void)(event, props);
    await flushEvents();

    return sent[0][0];
  }

  it("never writes an analytics event to AsyncStorage", async () => {
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    setEventSink(sinkCapturing([]));

    track("consent.granted", {});

    // Holding a pre-consent event ON DISK would be storage on terminal equipment before
    // consent, which is the thing ePrivacy Art. 5(3) governs. The pending buffer is memory
    // only, and this is what keeps it that way.
    const analyticsWrites = setItem.mock.calls.filter(([key]) => key !== "@stigvidd_rum_consent");
    expect(analyticsWrites).toHaveLength(0);
  });

  it("redacts a location-shaped property that a call site passed anyway", async () => {
    const record = await sendAndCapture("consent.granted", { latitude: 57.7, startCoordinate: "57.70891,12.93" });

    // redact() replaces the VALUE with a marker rather than removing the key, so the
    // assertion is that no real position survives — not that the field vanished.
    expect(record.latitude).toBe("[redacted]");
    expect(record.startCoordinate).toBe("[redacted]");
    expect(JSON.stringify(record)).not.toContain("57.7");
  });

  it("coarsens numbers so a coordinate cannot survive as a numeric value", async () => {
    // The hole this closes: redact()'s coordinate pattern only ever runs on STRINGS, so a
    // mis-named numeric property would otherwise pass through at full precision.
    const record = await sendAndCapture("hike.recording_stopped", {
      reason: "user",
      durationSeconds: 1800,
      distanceMeters: 4321.98765,
      pointCount: 900,
    });

    expect(record.distanceMeters).toBe(4321.99);
  });

  it("does not let a property shadow the envelope", async () => {
    const record = await sendAndCapture("consent.granted", {
      event: "spoofed",
      sessionId: "spoofed",
      level: "error",
    });

    expect(record.event).toBe("consent.granted");
    expect(record.sessionId).not.toBe("spoofed");
    expect(record.level).toBe("info");
  });

  it("carries no user, subject or email field", async () => {
    const record = await sendAndCapture("hike.recording_started", {
      engine: "native_ios",
      backgroundPermission: "granted",
    });

    const identifierish = Object.keys(record).filter((k) => /user|sub|email|ip\b/i.test(k));
    expect(identifierish).toEqual([]);
  });

  it("sends the session id, which changes between launches and is never stored", async () => {
    const first = await sendAndCapture("consent.granted", {});

    resetAnalytics();
    resetConsent();

    const second = await sendAndCapture("consent.granted", {});

    expect(first.sessionId).toEqual(expect.any(String));
    expect(second.sessionId).not.toBe(first.sessionId);

    const stored = await AsyncStorage.getItem("@stigvidd_session_id");
    expect(stored).toBeNull();
  });
});

describe("without a sink", () => {
  it("does nothing and makes no request", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    await setConsent("granted");

    track("consent.granted", {});
    await flushEvents();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
