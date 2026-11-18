// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getAppInfo } from "./app-info";
import { getConsentSync, subscribeConsent, type ConsentState } from "./consent";
import { redact } from "./logger";
import type { EventCatalogue, EventName } from "./event-catalogue";

// keep-comment: not logger.track(): the logger persists unsent records (storage before consent, ePrivacy 5(3)),
// keep-comment: retries (keeps unconsented data alive), has one buffer (a decline must discard events only)
// keep-comment: and one stream (events need their own, OpenObserve's only erasure unit). redact() is shared.
// keep-comment: never extract a package shared with web/analytics.ts: the licences differ (MPL vs AGPL,
// keep-comment: docs/notes/licence-is-per-area-not-repo-wide.md) and so do the legal bases (consent vs
// keep-comment: legitimate interest); a shared catalogue would let the app collect without consent

type AnalyticsEvent = Record<string, unknown>;

export type EventSink = (events: AnalyticsEvent[]) => void | Promise<void>;

// keep-comment: held while consent is unknown; small and lossy, since before consent the right failure is to forget
const MAX_PENDING = 50;

const MAX_BUFFERED = 100;

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;

// keep-comment: bump when the envelope shape changes
const SCHEMA_VERSION = 1;

let pending: AnalyticsEvent[] = [];
let buffer: AnalyticsEvent[] = [];
let sink: EventSink | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
let unsubscribe: (() => void) | undefined;

// keep-comment: new every launch and never persisted, so it is not a persistent identifier
let sessionId = newSessionId();

const appInfo = getAppInfo();

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// keep-comment: redact() only scrubs strings, so a numeric coordinate would pass; two decimals is ~1.1 km
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

// keep-comment: synchronous, so no call site can await telemetry
export function track<N extends EventName>(event: N, props: EventCatalogue[N]): void {
  const consent = getConsentSync();

  // keep-comment: dropped here, before anything is buffered; a check at flush time is the version that breaks
  if (consent === "denied") return;

  const record: AnalyticsEvent = {
    // keep-comment: first, so a prop named `event` or `level` cannot shadow the envelope
    ...(redact(coarsen(props as Record<string, unknown>)) ?? {}),
    _timestamp: Date.now() * 1000, // keep-comment: OpenObserve wants microseconds
    level: "info",
    message: event,
    event,
    schema: SCHEMA_VERSION,
    app: "stigvidd-app",
    appVersion: appInfo.appVersion,
    platform: appInfo.platform,
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

// keep-comment: a decline destroys what is held; holding it "until yes" is not what a decline means
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

  // keep-comment: hydration can beat the sink, so adopt the current state now
  setAnalyticsConsent(getConsentSync());

  unsubscribe?.();
  unsubscribe = subscribeConsent(setAnalyticsConsent);
}

// keep-comment: no retry: a failed batch is dropped, since a lost batch costs only a rounding error
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
    // keep-comment: dropped on purpose
  } finally {
    flushing = false;

    if (buffer.length > 0) schedule();
  }
}

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

// keep-comment: for tests only
export function analyticsBufferSizes(): { pending: number; buffered: number } {
  return { pending: pending.length, buffered: buffer.length };
}
