// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import type { PushType } from "./notifications";

// keep-comment: this file IS the privacy disclosure (privacy policy §2); adding an event is a privacy decision. Rules:
// keep-comment: 1. no position ever, not even a map centre or bounding box; shape only (counts, distances)
// keep-comment: 2. no id beyond the session id: a trail id infers location, a friend id builds a social graph
// keep-comment: 3. no free text (reviews, searches, URLs); only numbers, booleans and literal unions
// keep-comment: no consent.denied or consent.revoked: sending "I do not consent" would be self-contradictory
// keep-comment: names are domain.action, snake_case within a part, so `event LIKE 'hike.%'` works

export type RecordingStopReason = "user" | "inactivity" | "max_duration" | "recovery";

export type RecordingEngine = "native_ios" | "expo_task";

export type EventCatalogue = {
  // keep-comment: engine and background permission explain most "holes in my track" reports
  "hike.recording_started": {
    engine: RecordingEngine;
    backgroundPermission: "granted" | "denied";
  };

  // keep-comment: distance + duration + time weakly fingerprints one walk; no position, 7-day stream: accepted residual
  "hike.recording_stopped": {
    reason: RecordingStopReason;
    durationSeconds: number;
    distanceMeters: number;
    pointCount: number;
  };

  // keep-comment: how many friends, never who (rule 2)
  "hike.shared": {
    kind: "share" | "reshare";
    outcome: "success" | "recipient_unavailable" | "not_allowed" | "error";
    recipientCount: number;
    allowResharing: boolean;
  };

  // keep-comment: uploaded < requested means some failed
  "hike.images_added": {
    requested: number;
    uploaded: number;
  };

  "hike.image_removed": Record<string, never>;

  // keep-comment: no image, hike or author id (rule 2)
  "hike.image_reported": Record<string, never>;

  // keep-comment: the disclosure; coverOk/invitesOk say whether the follow-up uploads worked
  "event.saved": {
    kind: "create" | "update";
    visibility: "Open" | "Private";
    route: "none" | "trail" | "hike" | "kept";
    hasMeetingPoint: boolean;
    hasCapacity: boolean;
    inviteCount: number;
    coverOk: boolean;
    invitesOk: boolean;
  };

  "event.membership_changed": {
    action: "join" | "leave" | "accept" | "decline";
  };

  "event.post_created": Record<string, never>;

  "event.route_followed": {
    hasRoute: boolean;
  };

  "push.opened": {
    type: PushType | "unknown";
    routed: boolean;
  };

  "area.list_viewed": {
    sort: "distance" | "popularity";
    count: number;
  };

  // keep-comment: no counts, since an area's trail and facility counts can name it (rule 2)
  "area.opened": Record<string, never>;

  "consent.granted": Record<string, never>;
};

export type EventName = keyof EventCatalogue;
