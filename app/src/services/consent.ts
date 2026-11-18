// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AsyncStorage from "@react-native-async-storage/async-storage";

// keep-comment: analytics need prior opt-in consent (GDPR + Swedish ePrivacy); error logs do not,
// keep-comment: so `logger` must never be routed through here (docs/observability.md)
// keep-comment: "unknown" is not "declined": events are held unsent until a grant releases or a decline discards them

export type ConsentState = "granted" | "denied" | "unknown";

const CONSENT_STORAGE_KEY = "@stigvidd_rum_consent";

// keep-comment: synchronous, or every track() call site turns async and telemetry lands on a user's critical path
// keep-comment: starts "unknown", the safe direction: nothing is sent before hydration
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
    // keep-comment: an unreadable choice is never taken as a yes
    return "unknown";
  }
}

export async function setConsent(state: Exclude<ConsentState, "unknown">): Promise<void> {
  // keep-comment: published first, so a decline holds this session even if the write fails
  publish(state);

  try {
    await AsyncStorage.setItem(CONSENT_STORAGE_KEY, state);
  } catch {
    // keep-comment: the in-session choice still applies
  }
}

export async function loadConsent(): Promise<ConsentState> {
  const stored = await getConsent();

  hydrated = true;
  publish(stored);

  return stored;
}

export function getConsentSync(): ConsentState {
  return cached;
}

// keep-comment: the prompt waits on this, or a returning user is asked again every launch
export function isConsentHydrated(): boolean {
  return hydrated;
}

export function subscribeConsent(subscriber: (state: ConsentState) => void): () => void {
  subscribers.add(subscriber);

  return () => {
    subscribers.delete(subscriber);
  };
}

export function resetConsent(): void {
  cached = "unknown";
  hydrated = false;
  subscribers.clear();
}
