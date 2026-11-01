// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { HikingEvent } from "@/data/types";
import {
  clampDeadline,
  EventFormValues,
  emptyEventForm,
  eventFormFromEvent,
  parseMaxParticipants,
  toCreateEventRequest,
  toUpdateEventRequest,
  validateEventForm,
} from "@/utils/event-form";

const NOW = new Date("2026-11-01T10:00:00Z");
const HOUR = 60 * 60 * 1000;

function at(offsetHours: number): Date {
  return new Date(NOW.getTime() + offsetHours * HOUR);
}

function valid(overrides: Partial<EventFormValues> = {}): EventFormValues {
  return {
    ...emptyEventForm(),
    title: "Kvällsvandring",
    startsAt: at(48),
    meetingPoint: [12.94, 57.72],
    ...overrides,
  };
}

function stored(overrides: Partial<HikingEvent> = {}): HikingEvent {
  return {
    identifier: "e1",
    title: "Kvällsvandring",
    description: "",
    startsAt: at(-1).toISOString(),
    participantCount: 2,
    interestedCount: 0,
    visibility: "Open",
    allowParticipantInvites: false,
    status: "Published",
    isPast: false,
    hasPendingInvite: false,
    meetingPointLongitude: 12.94,
    meetingPointLatitude: 57.72,
    permissions: {
      canEdit: true,
      canCancel: true,
      canDelete: true,
      canInvite: true,
      canJoin: false,
      canMarkInterested: false,
      canChangeRoles: true,
      canRemoveParticipants: true,
      canPinOrDeletePosts: true,
      canReadBoard: true,
      canPost: true,
    },
    ...overrides,
  };
}

describe("validateEventForm", () => {
  it("accepts a complete form", () => {
    expect(validateEventForm(valid(), NOW)).toEqual({});
  });

  it("asks for a title, a start and a place", () => {
    const errors = validateEventForm({ ...emptyEventForm(), title: "  " }, NOW);
    expect(errors).toEqual({
      title: "events.form.errors.titleRequired",
      startsAt: "events.form.errors.startRequired",
      place: "events.form.errors.placeRequired",
    });
  });

  it("counts a trail or a hike as the place", () => {
    const trail = valid({ meetingPoint: null, route: { kind: "trail", identifier: "t1", name: "Rya" } });
    expect(validateEventForm(trail, NOW).place).toBeUndefined();
  });

  it("refuses a start in the past on create", () => {
    expect(validateEventForm(valid({ startsAt: at(-1) }), NOW).startsAt).toBe("events.form.errors.startInPast");
  });

  it("lets an ongoing event be edited when its start is unchanged, seconds dropped by the picker included", () => {
    const original = stored({ startsAt: new Date(at(-1).getTime() + 30_000).toISOString() });
    const form = { ...eventFormFromEvent(original), startsAt: at(-1), description: "Ny text" };
    expect(validateEventForm(form, NOW, original)).toEqual({});
  });

  it("refuses moving an event's start into the past", () => {
    const original = stored({ startsAt: at(24).toISOString() });
    const form = { ...eventFormFromEvent(original), startsAt: at(-2) };
    expect(validateEventForm(form, NOW, original).startsAt).toBe("events.form.errors.startInPast");
  });

  it("refuses an end before the start and an event longer than 14 days", () => {
    expect(validateEventForm(valid({ endsAt: at(47) }), NOW).endsAt).toBe("events.form.errors.endBeforeStart");
    expect(validateEventForm(valid({ endsAt: at(48 + 15 * 24) }), NOW).endsAt).toBe("events.form.errors.tooLong");
  });

  it("refuses a deadline after the start", () => {
    expect(validateEventForm(valid({ registrationDeadline: at(49) }), NOW).registrationDeadline).toBe(
      "events.form.errors.deadlineAfterStart",
    );
  });

  it("keeps max participants between 2 and 500, or empty", () => {
    expect(validateEventForm(valid({ maxParticipants: "1" }), NOW).maxParticipants).toBeDefined();
    expect(validateEventForm(valid({ maxParticipants: "501" }), NOW).maxParticipants).toBeDefined();
    expect(validateEventForm(valid({ maxParticipants: "8a" }), NOW).maxParticipants).toBeDefined();
    expect(validateEventForm(valid({ maxParticipants: "2" }), NOW).maxParticipants).toBeUndefined();
    expect(validateEventForm(valid({ maxParticipants: "" }), NOW).maxParticipants).toBeUndefined();
  });

  it("lets an event whose trail was deleted keep its stored location", () => {
    const original = stored({ meetingPointLongitude: null, meetingPointLatitude: null });
    expect(validateEventForm(eventFormFromEvent(original), NOW, original).place).toBeUndefined();
  });
});

describe("parseMaxParticipants", () => {
  it("reads empty as no limit and junk as invalid", () => {
    expect(parseMaxParticipants(" ")).toBeNull();
    expect(parseMaxParticipants("12")).toBe(12);
    expect(parseMaxParticipants("-3")).toBeUndefined();
  });
});

describe("requests", () => {
  it("sends times with Z and the meeting point as a lon/lat pair", () => {
    const request = toCreateEventRequest(valid({ meetingPointName: " Parkeringen ", maxParticipants: "8" }));
    expect(request.startsAt).toBe(at(48).toISOString());
    expect(request.startsAt.endsWith("Z")).toBe(true);
    expect(request.meetingPointLongitude).toBe(12.94);
    expect(request.meetingPointLatitude).toBe(57.72);
    expect(request.meetingPointName).toBe("Parkeringen");
    expect(request.maxParticipants).toBe(8);
    expect(request.visibility).toBe("Open");
  });

  it("sends a hike with its trim and no trail", () => {
    const request = toCreateEventRequest(
      valid({ route: { kind: "hike", identifier: "h1", name: "Min", trimStart: 3, trimEnd: null, lengthMeters: 1 } }),
    );
    expect(request.hikeIdentifier).toBe("h1");
    expect(request.trailIdentifier).toBeNull();
    expect(request.routeTrimStartIndex).toBe(3);
    expect(request.routeTrimEndIndex).toBeNull();
  });

  it("keeps a stored own route by sending neither a hike nor removeRoute", () => {
    const original = stored({ route: { kind: "Own", lengthMeters: 4000 } });
    const request = toUpdateEventRequest(eventFormFromEvent(original), original);
    expect(request.hikeIdentifier).toBeNull();
    expect(request.removeRoute).toBe(false);
  });

  it("asks to remove a stored own route the user took away", () => {
    const original = stored({ route: { kind: "Own", lengthMeters: 4000 } });
    const request = toUpdateEventRequest({ ...eventFormFromEvent(original), route: { kind: "none" } }, original);
    expect(request.removeRoute).toBe(true);
  });

  it("drops the meeting point name along with the point", () => {
    const request = toCreateEventRequest(
      valid({ meetingPoint: null, meetingPointName: "Kvar", route: { kind: "trail", identifier: "t", name: "T" } }),
    );
    expect(request.meetingPointName).toBeNull();
    expect(request.meetingPointLongitude).toBeNull();
  });
});

describe("clampDeadline", () => {
  const start = new Date(2026, 10, 5, 9, 30);

  it("moves a deadline later on the start's day back to the start", () => {
    expect(clampDeadline(new Date(2026, 10, 5, 12, 0), start)).toEqual(start);
  });

  it("keeps a deadline on an earlier day", () => {
    const deadline = new Date(2026, 10, 4, 12, 0);
    expect(clampDeadline(deadline, start)).toBe(deadline);
  });

  it("leaves a deadline on a later day for the validator to refuse", () => {
    const deadline = new Date(2026, 10, 6, 12, 0);
    expect(clampDeadline(deadline, start)).toBe(deadline);
  });

  it("passes through a cleared deadline or a missing start", () => {
    expect(clampDeadline(null, start)).toBeNull();
    const deadline = new Date(2026, 10, 5, 12, 0);
    expect(clampDeadline(deadline, null)).toBe(deadline);
  });
});
