// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CoverChange, useSaveEvent } from "@/hooks/events/useSaveEvent";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { EventFormValues, emptyEventForm } from "@/utils/event/event-form";
import { act } from "@testing-library/react-native";

const mockCreate = jest.fn();
const mockSetImage = jest.fn();
const mockInvite = jest.fn();

jest.mock("@/api/events", () => ({
  createEvent: (...args: unknown[]) => mockCreate(...args),
  updateEvent: jest.fn(),
  setEventImage: (...args: unknown[]) => mockSetImage(...args),
  deleteEventImage: jest.fn(),
  inviteToEvent: (...args: unknown[]) => mockInvite(...args),
}));

const mockTrack = jest.fn();
jest.mock("@/services/analytics", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

function values(overrides: Partial<EventFormValues> = {}): EventFormValues {
  return {
    ...emptyEventForm(),
    title: "Kvällsvandring",
    startsAt: new Date("2030-06-01T17:00:00Z"),
    meetingPoint: [12.94, 57.72],
    ...overrides,
  };
}

async function save(input: EventFormValues, cover: CoverChange) {
  let hook: ReturnType<typeof useSaveEvent> | undefined;
  function Probe() {
    hook = useSaveEvent();
    return null;
  }
  await renderWithProviders(<Probe />);
  const current = () => {
    if (!hook) throw new Error("expected the hook to have rendered");
    return hook;
  };

  await act(() => current().mutate({ values: input, cover }));
  await flushUntil(() => current().isSuccess || current().isError);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ identifier: "e1" });
  mockSetImage.mockResolvedValue({});
  mockInvite.mockResolvedValue(undefined);
});

it("counts a created event by its shape, never its title or place", async () => {
  await save(values({ visibility: "Private", invitees: ["Eremiten", "SkogsGreven"], maxParticipants: "8" }), {
    uri: "file://cover.jpg",
    focusY: 0.5,
  });

  expect(mockTrack).toHaveBeenCalledWith("event.saved", {
    kind: "create",
    visibility: "Private",
    route: "none",
    hasMeetingPoint: true,
    hasCapacity: true,
    inviteCount: 2,
    coverOk: true,
    invitesOk: true,
  });
});

it("says when the cover or the invitations failed after the event was saved", async () => {
  mockSetImage.mockRejectedValue(new Error("upload failed"));
  mockInvite.mockRejectedValue(new Error("invite failed"));
  await save(values({ visibility: "Private", invitees: ["Eremiten"] }), { uri: "file://cover.jpg", focusY: 0 });

  expect(mockTrack).toHaveBeenCalledWith("event.saved", expect.objectContaining({ coverOk: false, invitesOk: false }));
});

it("counts nothing when the event itself was not saved", async () => {
  mockCreate.mockRejectedValue(new Error("boom"));
  await save(values(), null);

  expect(mockTrack).not.toHaveBeenCalled();
});
