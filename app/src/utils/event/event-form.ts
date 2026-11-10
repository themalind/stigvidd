// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { EVENT_REQUEST_LIMITS } from "@/constants/event-limits";
import { CreateEventRequest, EventVisibility, HikingEvent, UpdateEventRequest } from "@/data/types";
import { sameDay } from "@/utils/event/event-time";

const DAY_MS = 24 * 60 * 60 * 1000;
// A picker drops seconds, so an unchanged time can read as moved. keep-comment: mirrors EventService.Moved
const MOVED_TOLERANCE_MS = 60 * 1000;

export type EventRouteChoice =
  | { kind: "none" }
  | { kind: "trail"; identifier: string; name: string; lengthMeters?: number | null }
  | {
      kind: "hike";
      identifier: string;
      name: string;
      trimStart: number | null;
      trimEnd: number | null;
      lengthMeters: number;
    }
  // The stored own route, left as it is. keep-comment: an edit cannot re-send a copied route
  | { kind: "kept"; lengthMeters?: number | null };

export interface EventFormValues {
  title: string;
  description: string;
  startsAt: Date | null;
  endsAt: Date | null;
  registrationDeadline: Date | null;
  route: EventRouteChoice;
  meetingPoint: GeoJSON.Position | null;
  meetingPointName: string;
  locationName: string | null;
  visibility: EventVisibility;
  maxParticipants: string;
  allowParticipantInvites: boolean;
  invitees: string[];
}

export type EventFormField =
  | "title"
  | "description"
  | "startsAt"
  | "endsAt"
  | "registrationDeadline"
  | "place"
  | "meetingPointName"
  | "maxParticipants";

export type EventFormErrorKey =
  | "events.form.errors.titleRequired"
  | "events.form.errors.titleTooLong"
  | "events.form.errors.descriptionTooLong"
  | "events.form.errors.startRequired"
  | "events.form.errors.startInPast"
  | "events.form.errors.startTooFar"
  | "events.form.errors.endBeforeStart"
  | "events.form.errors.tooLong"
  | "events.form.errors.deadlineAfterStart"
  | "events.form.errors.deadlineInPast"
  | "events.form.errors.placeRequired"
  | "events.form.errors.placeNameTooLong"
  | "events.form.errors.participantsRange";

export type EventFormErrors = Partial<Record<EventFormField, EventFormErrorKey>>;

export function emptyEventForm(): EventFormValues {
  return {
    title: "",
    description: "",
    startsAt: null,
    endsAt: null,
    registrationDeadline: null,
    route: { kind: "none" },
    meetingPoint: null,
    meetingPointName: "",
    locationName: null,
    visibility: "Open",
    maxParticipants: "",
    allowParticipantInvites: false,
    invitees: [],
  };
}

function routeOf(event: HikingEvent): EventRouteChoice {
  if (event.trailIdentifier)
    return {
      kind: "trail",
      identifier: event.trailIdentifier,
      name: event.trailName ?? "",
      lengthMeters: event.route?.lengthMeters,
    };
  if (event.route?.kind === "Own") return { kind: "kept", lengthMeters: event.route.lengthMeters };
  return { kind: "none" };
}

export function eventFormFromEvent(event: HikingEvent): EventFormValues {
  const lon = event.meetingPointLongitude;
  const lat = event.meetingPointLatitude;
  return {
    title: event.title,
    description: event.description,
    startsAt: new Date(event.startsAt),
    endsAt: event.endsAt ? new Date(event.endsAt) : null,
    registrationDeadline: event.registrationDeadline ? new Date(event.registrationDeadline) : null,
    route: routeOf(event),
    meetingPoint: lon == null || lat == null ? null : [lon, lat],
    meetingPointName: event.meetingPointName ?? "",
    locationName: event.locationName ?? null,
    visibility: event.visibility,
    maxParticipants: event.maxParticipants == null ? "" : String(event.maxParticipants),
    allowParticipantInvites: event.allowParticipantInvites,
    invitees: [],
  };
}

function moved(next: Date | null, previous: string | null | undefined): boolean {
  if (!next) return false;
  if (!previous) return true;
  return Math.abs(next.getTime() - Date.parse(previous)) >= MOVED_TOLERANCE_MS;
}

// A deadline picked on the start's day but after its time becomes the start. keep-comment: the date-only picker cannot set an earlier time
export function clampDeadline(deadline: Date | null, start: Date | null): Date | null {
  if (!deadline || !start || deadline.getTime() <= start.getTime()) return deadline;
  return sameDay(deadline, start) ? new Date(start.getTime()) : deadline;
}

export function parseMaxParticipants(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

// Mirrors the backend validator and EventService's edit rules. keep-comment: the server stays the authority
export function validateEventForm(values: EventFormValues, now: Date, original?: HikingEvent): EventFormErrors {
  const errors: EventFormErrors = {};
  const title = values.title.trim();
  if (title === "") errors.title = "events.form.errors.titleRequired";
  else if (title.length > EVENT_REQUEST_LIMITS.title) errors.title = "events.form.errors.titleTooLong";

  if (values.description.trim().length > EVENT_REQUEST_LIMITS.description)
    errors.description = "events.form.errors.descriptionTooLong";

  const start = values.startsAt;
  if (!start) errors.startsAt = "events.form.errors.startRequired";
  else {
    const startMoved = !original || moved(start, original.startsAt);
    if (startMoved && start.getTime() <= now.getTime()) errors.startsAt = "events.form.errors.startInPast";
    else if (start.getTime() > now.getTime() + EVENT_REQUEST_LIMITS.maxLeadDays * DAY_MS)
      errors.startsAt = "events.form.errors.startTooFar";
  }

  if (start && values.endsAt) {
    if (values.endsAt.getTime() <= start.getTime()) errors.endsAt = "events.form.errors.endBeforeStart";
    else if (values.endsAt.getTime() - start.getTime() > EVENT_REQUEST_LIMITS.maxDurationDays * DAY_MS)
      errors.endsAt = "events.form.errors.tooLong";
  }

  const deadline = values.registrationDeadline;
  if (deadline) {
    if (start && deadline.getTime() > start.getTime())
      errors.registrationDeadline = "events.form.errors.deadlineAfterStart";
    else if ((!original || moved(deadline, original.registrationDeadline)) && deadline.getTime() < now.getTime())
      errors.registrationDeadline = "events.form.errors.deadlineInPast";
  }

  const hasPlace = values.meetingPoint !== null || values.route.kind !== "none";
  // An event whose trail was deleted keeps its stored location. keep-comment: EventService's keptLocation rule
  const keepsStoredLocation = !!original && !original.trailIdentifier && original.route == null;
  if (!hasPlace && !keepsStoredLocation) errors.place = "events.form.errors.placeRequired";

  if (values.meetingPointName.trim().length > EVENT_REQUEST_LIMITS.placeName)
    errors.meetingPointName = "events.form.errors.placeNameTooLong";

  const max = parseMaxParticipants(values.maxParticipants);
  if (
    max === undefined ||
    (max !== null && (max < EVENT_REQUEST_LIMITS.minParticipants || max > EVENT_REQUEST_LIMITS.maxParticipants))
  )
    errors.maxParticipants = "events.form.errors.participantsRange";

  return errors;
}

function blank(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

function baseRequest(values: EventFormValues) {
  const start = values.startsAt;
  if (!start) throw new Error("expected a start time");
  const route = values.route;
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    trailIdentifier: route.kind === "trail" ? route.identifier : null,
    hikeIdentifier: route.kind === "hike" ? route.identifier : null,
    routeTrimStartIndex: route.kind === "hike" ? route.trimStart : null,
    routeTrimEndIndex: route.kind === "hike" ? route.trimEnd : null,
    locationName: values.locationName,
    meetingPointLongitude: values.meetingPoint ? values.meetingPoint[0] : null,
    meetingPointLatitude: values.meetingPoint ? values.meetingPoint[1] : null,
    meetingPointName: values.meetingPoint ? blank(values.meetingPointName) : null,
    startsAt: start.toISOString(),
    endsAt: values.endsAt ? values.endsAt.toISOString() : null,
    registrationDeadline: values.registrationDeadline ? values.registrationDeadline.toISOString() : null,
    maxParticipants: parseMaxParticipants(values.maxParticipants) ?? null,
    allowParticipantInvites: values.allowParticipantInvites,
  };
}

export function toCreateEventRequest(values: EventFormValues): Omit<CreateEventRequest, "clientRequestId"> {
  return { ...baseRequest(values), visibility: values.visibility };
}

export function toUpdateEventRequest(values: EventFormValues, original: HikingEvent): UpdateEventRequest {
  const hadOwnRoute = original.route?.kind === "Own";
  return { ...baseRequest(values), removeRoute: hadOwnRoute && values.route.kind === "none" };
}
