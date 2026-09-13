// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Platform } from "react-native";
import Constants from "expo-constants";

import { getConsentSync, subscribeConsent, type ConsentState } from "./consent";
import { redact } from "./logger";
import type { EventCatalogue, EventName } from "./event-catalogue";

/**
 * Consent-gated product analytics.
 *
 * ── Why this is not a `track()` method on `logger` ──────────────────────────────────────
 *
 * The logger already solves batching, offline replay, backoff and redaction, so reusing it
 * looks free. Four of its behaviours are actively wrong here:
 *
 *  - It PERSISTS unsent records to AsyncStorage on background. An event held pending consent
 *    and written to disk is storage on terminal equipment before consent, which is the exact
 *    thing ePrivacy Art. 5(3) governs. Sharing a buffer would make that automatic.
 *  - It RETRIES with backoff. An error log is not droppable; an analytics event is. Retrying
 *    analytics only keeps non-consented data alive longer.
 *  - It has ONE buffer. A decline has to DISCARD what is buffered, and partitioning a mixed
 *    buffer at flush time would put the consent check on the hot path — precisely where it
 *    would later break quietly.
 *  - It has ONE sink, and therefore one stream. Stream is the only erasure granularity
 *    OpenObserve has, so events get their own: `stigvidd_app_events` can be dropped wholesale
 *    without destroying the 7-day error safety net.
 *
 * What IS shared is `redact()`, imported from the logger. One redaction implementation, two
 * egress paths through it.
 *
 * ── Why this is duplicated in web/ rather than extracted ────────────────────────────────
 *
 * `web/src/services/analytics.ts` is a near-twin and must stay one. Do not "helpfully" extract
 * a shared package:
 *
 *  - LICENCE. This area is MPL-2.0 with Exhibit B deliberately omitted; `web/` is
 *    AGPL-3.0-or-later. A shared AGPL module linked from here recreates the App Store conflict
 *    the split exists to avoid, and a shared MPL module lands where REUSE.toml's catch-all
 *    assigns AGPL. See docs/notes/licence-is-per-area-not-repo-wide.md.
 *  - LEGAL BASIS. This catalogue is consumer behavioural data under OPT-IN CONSENT. The web
 *    one is operational data about admin actions under LEGITIMATE INTEREST. Merging them
 *    merges two legal bases into one code path, and the first refactor that adds a page-view
 *    event to the shared catalogue silently makes this app collect without consent.
 */

type AnalyticsEvent = Record<string, unknown>;

export type EventSink = (events: AnalyticsEvent[]) => void | Promise<void>;

/**
 * Held while consent is "unknown". Small and lossy on purpose: this is the pre-consent window,
 * so the right failure is to forget, never to accumulate.
 */
const MAX_PENDING = 50;

/** Held after a grant, waiting for a flush. Drop-oldest; an event is not worth memory pressure. */
const MAX_BUFFERED = 100;

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;

/** Bumped when the envelope shape changes, so old records stay interpretable. */
const SCHEMA_VERSION = 1;

let pending: AnalyticsEvent[] = [];
let buffer: AnalyticsEvent[] = [];
let sink: EventSink | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
let unsubscribe: (() => void) | undefined;

/**
 * Regenerated every launch and NEVER persisted.
 *
 * That is what keeps it out of "persistent identifier" territory: it correlates the events of
 * one app run, which is what makes a funnel readable, and correlates nothing across runs,
 * devices or reinstalls.
 */
let sessionId = newSessionId();

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Rounds every numeric property to two decimals.
 *
 * This closes a real hole rather than being tidiness. `redact()` scrubs coordinate-shaped
 * text, but its COORD_PATTERN only ever runs on strings — and event properties are mostly
 * numbers, so a mis-named numeric property (`startPoint: 57.70891`) would sail through
 * untouched. Two decimals is ~1.1 km, which is useless as a position, and nothing in the
 * catalogue needs more precision than that. It makes a coordinate unrepresentable rather than
 * merely discouraged.
 */
function coarsen(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    out[key] = typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
  }

  return out;
}

function schedule(): void {
  if (timer !== undefined) return;

  timer = setTimeout(() => {
    timer = undefined;
    void flushEvents();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Records one event.
 *
 * Synchronous by design: consent is read from the in-memory cache, so no call site becomes
 * async and no call site can accidentally `await` telemetry.
 */
export function track<N extends EventName>(event: N, props: EventCatalogue[N]): void {
  const consent = getConsentSync();

  // The front door. A declined user's event is dropped HERE — before redaction, before the
  // envelope is built, before anything is buffered — so there is no code path on which it
  // could later be flushed. Checking at flush time instead is the shape of this that breaks.
  if (consent === "denied") return;

  const record: AnalyticsEvent = {
    // Props spread FIRST so that a property named `event`, `level` or `sessionId` cannot
    // shadow the envelope. Same reasoning as the context spread in telemetry.ts.
    ...(redact(coarsen(props as Record<string, unknown>)) ?? {}),
    _timestamp: Date.now() * 1000, // OpenObserve wants microseconds
    level: "info",
    message: event, // so an ad-hoc query against the stream still reads
    event,
    schema: SCHEMA_VERSION,
    app: "stigvidd-app",
    appVersion: Constants.expoConfig?.version ?? "unknown",
    platform: Platform.OS,
    sessionId,
  };

  if (consent === "unknown") {
    pending.push(record);

    if (pending.length > MAX_PENDING) pending = pending.slice(-MAX_PENDING);

    return;
  }

  buffer.push(record);

  if (buffer.length > MAX_BUFFERED) buffer = buffer.slice(-MAX_BUFFERED);
  if (buffer.length >= BATCH_SIZE) {
    void flushEvents();

    return;
  }

  schedule();
}

/**
 * Applies a consent decision to whatever is already held.
 *
 * A grant releases the pending events; a decline destroys them. The decline branch is the one
 * that matters legally — "held until they say yes" is not what a decline means.
 */
export function setAnalyticsConsent(state: ConsentState): void {
  if (state === "granted") {
    buffer = buffer.concat(pending);
    pending = [];

    if (buffer.length > MAX_BUFFERED) buffer = buffer.slice(-MAX_BUFFERED);
    if (buffer.length > 0) schedule();

    return;
  }

  if (state === "denied") {
    pending = [];
    buffer = [];
  }
}

export function setEventSink(next: EventSink): void {
  sink = next;

  // Consent may have been decided before the sink existed (hydration races bootstrap), so
  // adopt the current state rather than waiting for the next change.
  setAnalyticsConsent(getConsentSync());

  unsubscribe?.();
  unsubscribe = subscribeConsent(setAnalyticsConsent);
}

/**
 * Ships what is buffered. Unlike the logger there is no retry: a failed batch is DROPPED.
 *
 * That is deliberate. Re-queuing would hold non-consented-retention data longer for a signal
 * whose whole value is statistical, and a lost batch costs a rounding error in a dashboard.
 */
export async function flushEvents(): Promise<void> {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }

  if (flushing || !sink || buffer.length === 0) return;
  if (getConsentSync() !== "granted") return;

  const batch = buffer.slice(0, BATCH_SIZE);
  buffer = buffer.slice(batch.length);
  flushing = true;

  try {
    await sink(batch);
  } catch {
    // Dropped on purpose — see above.
  } finally {
    flushing = false;

    if (buffer.length > 0) schedule();
  }
}

/** Test seam, mirroring resetLogger(). */
export function resetAnalytics(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }

  pending = [];
  buffer = [];
  sink = undefined;
  flushing = false;
  sessionId = newSessionId();
  unsubscribe?.();
  unsubscribe = undefined;
}

/** Exposed for assertions; there is no reason for product code to read these. */
export function analyticsBufferSizes(): { pending: number; buffered: number } {
  return { pending: pending.length, buffered: buffer.length };
}
