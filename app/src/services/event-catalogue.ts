// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Every analytics event the app may send, and the exact properties each carries.
 *
 * This file IS the disclosure. What the privacy policy promises under "usage statistics"
 * (web/public/privacy-policy/index.html §2) is whatever is written here, so adding an entry is
 * a privacy decision before it is an engineering one. Three rules, none of them negotiable:
 *
 * 1. **No position, ever.** Not a coordinate, not a bounding box, not a map centre — a
 *    viewport IS a position. Log shape only: point counts, distances, accuracies. The
 *    redactor in logger.ts drops location-shaped KEYS, and `track()` additionally rounds every
 *    number to two decimals so a coordinate cannot survive as a numeric value either. Neither
 *    is permission to try.
 * 2. **No identifiers beyond the per-launch session id.** No trail id on browsing events, no
 *    friend or recipient id, no reported-content id. "Which trail did this person look at" is
 *    a location inference about that person; a friend id builds a social graph inside
 *    telemetry. Those belong in the database, not in a 7-day stream.
 * 3. **Free text never leaves the device.** No review body, no obstacle description, no search
 *    term, no URL. Bounded enums or counts only — which is why every property below is either
 *    a number, a boolean, or a union of literals.
 *
 * There is deliberately NO `consent.denied` and NO `consent.revoked` event. Transmitting an
 * event that says "I do not consent to events" is self-contradictory, and doing it anyway is
 * the kind of thing that makes the whole consent mechanism indefensible. A decline is recorded
 * on the device only.
 *
 * Naming: `domain.action`, lowercase, a dot between domain and action and snake_case within a
 * segment, so `event LIKE 'hike.%'` works as a query.
 */

/** Why a recording ended. */
export type RecordingStopReason = "user" | "inactivity" | "max_duration" | "recovery";

/** Which engine actually produced the fixes. */
export type RecordingEngine = "native_ios" | "expo_task";

export type EventCatalogue = {
  /**
   * A walk recording started. Says which engine is in use and whether background permission
   * was granted, which together explain most "my track has holes" reports.
   */
  "hike.recording_started": {
    engine: RecordingEngine;
    backgroundPermission: "granted" | "denied";
  };

  /**
   * A walk recording ended. The shape of the track, never the track.
   *
   * `distanceMeters` plus `durationSeconds` plus a timestamp is a weak fingerprint of one
   * specific walk. It carries no position, so it cannot locate anyone, and it ages out with
   * the 7-day stream — recorded here as a known and accepted residual rather than an oversight.
   */
  "hike.recording_stopped": {
    reason: RecordingStopReason;
    durationSeconds: number;
    distanceMeters: number;
    pointCount: number;
  };

  /**
   * The user granted analytics consent. The only consent event there is — see the note above
   * about why the other direction is not recorded.
   */
  "consent.granted": Record<string, never>;
};

export type EventName = keyof EventCatalogue;
