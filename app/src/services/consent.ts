// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Analytics consent.
 *
 * Session/interaction tracking is non-essential analytics, so under GDPR plus the ePrivacy
 * rules as implemented in Sweden it needs informed, prior, OPT-IN consent — it cannot ride on
 * legitimate interest. Crash reporting and error logs are a separate question and are
 * defensible without consent, since they are necessary to keep the service working. That
 * separation is load-bearing: `logger` must never be routed through this module.
 *
 * "Unknown" is a real state, distinct from "declined": before the user has been asked, events
 * are held in memory without being transmitted. Only an explicit grant releases them; an
 * explicit decline discards them.
 *
 * Consent must stay as easy to withdraw as it was to give (Art. 7(3)), which is why this is a
 * plain get/set that a Settings toggle can call at any time — see
 * components/settings/privacy-screen.tsx.
 *
 * See docs/observability.md.
 */

export type ConsentState = "granted" | "denied" | "unknown";

const CONSENT_STORAGE_KEY = "@stigvidd_rum_consent";

// The synchronous mirror of what is on disk.
//
// It exists because the gate in analytics.ts sits inside `track()`, which is called from
// render paths and from a background task. If reading consent were async then every call site
// would become async, and any one of them could be awaited — which is exactly how telemetry
// ends up on the critical path of a user action.
//
// It starts as "unknown", which is the safe direction: before hydration finishes nothing is
// transmitted, and the worst case is a handful of early events held in memory.
let cached: ConsentState = "unknown";
let hydrated = false;

const subscribers = new Set<(state: ConsentState) => void>();

function publish(state: ConsentState): void {
  cached = state;

  for (const subscriber of subscribers) {
    subscriber(state);
  }
}

export async function getConsent(): Promise<ConsentState> {
  try {
    const stored = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);

    return stored === "granted" || stored === "denied" ? stored : "unknown";
  } catch {
    // If we cannot read the choice we must not assume it was a yes.
    return "unknown";
  }
}

export async function setConsent(state: Exclude<ConsentState, "unknown">): Promise<void> {
  // Publish first. The in-session choice has to take effect even if the write fails, and a
  // decline that is not honoured until the next launch is the worse of the two failures.
  publish(state);

  try {
    await AsyncStorage.setItem(CONSENT_STORAGE_KEY, state);
  } catch {
    // Persisting failed; the in-session choice still applies via the cache above.
  }
}

/**
 * Reads the stored choice into the synchronous cache. Call once, early — initTelemetry does.
 */
export async function loadConsent(): Promise<ConsentState> {
  const stored = await getConsent();

  hydrated = true;
  publish(stored);

  return stored;
}

export function getConsentSync(): ConsentState {
  return cached;
}

/**
 * Whether the stored choice has been read yet. The consent prompt waits for this: without it
 * a returning user who already answered would be asked again on every launch, because the
 * cache reads "unknown" for the moment before hydration lands.
 */
export function isConsentHydrated(): boolean {
  return hydrated;
}

export function subscribeConsent(subscriber: (state: ConsentState) => void): () => void {
  subscribers.add(subscriber);

  return () => {
    subscribers.delete(subscriber);
  };
}

/** Test seam, mirroring resetLogger(). */
export function resetConsent(): void {
  cached = "unknown";
  hydrated = false;
  subscribers.clear();
}
