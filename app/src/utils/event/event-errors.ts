// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { apiErrorCode } from "@/api/core/api-error";

// The backend's EventErrorCodes; event-errors.test.ts fails when the two drift. keep-comment: a contract across areas
export const EVENT_ERROR_CODES = [
  "event_gone",
  "event_cancelled",
  "event_past",
  "registration_closed",
  "event_full",
  "invitation_gone",
  "removed_from_event",
  "not_allowed",
  "organizer_blocked",
  "too_many_upcoming",
  "too_many_today",
  "too_many_invites",
  "unknown_nicknames",
  "too_many_posts",
  "post_gone",
] as const;

export type EventErrorCode = (typeof EVENT_ERROR_CODES)[number];

// A join refused for being removed or for a hidden event gets no reason. keep-comment: a reason would reveal a block or a report
const JOIN_HIDDEN_REASONS: readonly string[] = ["removed_from_event", "event_gone"];

export function eventErrorCode(error: unknown): EventErrorCode | undefined {
  const code = apiErrorCode(error);
  return EVENT_ERROR_CODES.find((known) => known === code);
}

// The i18n key for a failed event action, or undefined when the error carries no known code. keep-comment: the caller then shows its own fallback
export type EventErrorKey = `events.errors.${EventErrorCode}` | "events.errors.cannotJoin";

export function eventErrorKey(error: unknown, action?: "join"): EventErrorKey | undefined {
  const code = eventErrorCode(error);
  if (code === undefined) return undefined;
  if (action === "join" && JOIN_HIDDEN_REASONS.includes(code)) return "events.errors.cannotJoin";
  return `events.errors.${code}`;
}
