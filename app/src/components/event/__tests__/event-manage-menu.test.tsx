// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import EventManageMenu, { manageMenuItems } from "@/components/event/event-manage-menu";
import { HikingEvent } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockNavigate = jest.fn();
let mockCanGoBack = true;

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    navigate: (...args: unknown[]) => mockNavigate(...args),
    canGoBack: () => mockCanGoBack,
  },
}));

jest.mock("@/api/content-reports", () => ({
  getReportReasons: () => Promise.resolve(["Spam"]),
  createContentReport: jest.fn(),
}));

const NO_PERMISSIONS = {
  canEdit: false,
  canCancel: false,
  canDelete: false,
  canInvite: false,
  canJoin: false,
  canMarkInterested: false,
  canChangeRoles: false,
  canRemoveParticipants: false,
  canPinOrDeletePosts: false,
  canReadBoard: false,
  canPost: false,
};

const ALL_HOST_PERMISSIONS = { ...NO_PERMISSIONS, canEdit: true, canInvite: true, canCancel: true, canDelete: true };

function hikingEvent(overrides: Partial<HikingEvent> = {}): HikingEvent {
  return {
    identifier: "e1",
    title: "Kvällsvandring",
    description: "",
    trailIdentifier: "t1",
    trailName: "Rya åsar runt",
    startsAt: "2026-11-05T17:30:00Z",
    participantCount: 1,
    interestedCount: 0,
    maxParticipants: null,
    visibility: "Open",
    allowParticipantInvites: false,
    status: "Published",
    isPast: false,
    organizerNickName: "Artemis",
    hasPendingInvite: false,
    permissions: { ...NO_PERMISSIONS },
    ...overrides,
  };
}

const onEdit = jest.fn();
const onInvite = jest.fn();
const onCancel = jest.fn();
const onDelete = jest.fn();

async function show(event: HikingEvent) {
  return renderWithProviders(
    <EventManageMenu event={event} onEdit={onEdit} onInvite={onInvite} onCancel={onCancel} onDelete={onDelete} />,
  );
}

async function choose(item: string) {
  await fireEvent.press(screen.getByTestId("event-manage-menu"));
  await flushUntil(() => screen.queryByText(item) !== null);
  await fireEvent.press(screen.getByText(item));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
});

describe("manageMenuItems", () => {
  it("gives a host every action they are allowed, and never a report of their own event", () => {
    const items = manageMenuItems(
      hikingEvent({ myRole: "Organizer", imageIdentifier: "img", permissions: ALL_HOST_PERMISSIONS }),
    );

    expect(items).toEqual({
      edit: true,
      invite: true,
      cancel: true,
      delete: true,
      reportEvent: false,
      reportImage: false,
    });
  });

  it.each([
    ["is cancelled", { status: "Cancelled" as const }],
    ["is over", { isPast: true }],
  ])("stops editing and inviting once the event %s, but still lets it be deleted", (_case, state) => {
    const items = manageMenuItems(hikingEvent({ myRole: "Organizer", permissions: ALL_HOST_PERMISSIONS, ...state }));

    expect(items.edit).toBe(false);
    expect(items.invite).toBe(false);
    expect(items.delete).toBe(true);
  });

  it("lets anyone else report the event, and the cover only when there is one", () => {
    expect(manageMenuItems(hikingEvent({ myRole: "Participant" }))).toMatchObject({
      reportEvent: true,
      reportImage: false,
    });
    expect(manageMenuItems(hikingEvent({ imageIdentifier: "img" }))).toMatchObject({ reportImage: true });
  });

  it("treats a co-host as a host, who does not report the event", () => {
    expect(manageMenuItems(hikingEvent({ myRole: "CoHost", imageIdentifier: "img" }))).toMatchObject({
      reportEvent: false,
      reportImage: false,
    });
  });
});

it("shows no menu at all when there is nothing to do", async () => {
  await show(hikingEvent({ myRole: "Organizer" }));

  expect(screen.queryByTestId("event-manage-menu")).toBeNull();
});

it.each([
  ["Redigera", onEdit],
  ["Bjud in", onInvite],
])("hands %s straight to the screen", async (item, handler) => {
  await show(hikingEvent({ myRole: "Organizer", permissions: ALL_HOST_PERMISSIONS }));

  await choose(item);

  expect(handler).toHaveBeenCalledTimes(1);
});

it("cancels the event only after the host confirms", async () => {
  await show(hikingEvent({ myRole: "Organizer", permissions: ALL_HOST_PERMISSIONS }));

  await choose("Ställ in evenemanget");
  expect(screen.getByText("Ställa in evenemanget?")).toBeTruthy();
  expect(onCancel).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId("event-cancel-dialog-confirm"));

  expect(onCancel).toHaveBeenCalledTimes(1);
});

it("keeps the event when the cancel dialog is dismissed", async () => {
  await show(hikingEvent({ myRole: "Organizer", permissions: ALL_HOST_PERMISSIONS }));

  await choose("Ställ in evenemanget");
  await fireEvent.press(screen.getByTestId("event-cancel-dialog-cancel"));
  await settle();

  expect(onCancel).not.toHaveBeenCalled();
});

describe("deleting", () => {
  it("leaves the event's screen once it is gone", async () => {
    onDelete.mockResolvedValue(undefined);
    await show(hikingEvent({ myRole: "Organizer", permissions: ALL_HOST_PERMISSIONS }));

    await choose("Ta bort evenemanget");
    await fireEvent.press(screen.getByTestId("event-delete-dialog-confirm"));
    await settle();

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("goes to the events tab when there is nothing to go back to", async () => {
    mockCanGoBack = false;
    onDelete.mockResolvedValue(undefined);
    await show(hikingEvent({ myRole: "Organizer", permissions: ALL_HOST_PERMISSIONS }));

    await choose("Ta bort evenemanget");
    await fireEvent.press(screen.getByTestId("event-delete-dialog-confirm"));
    await settle();

    expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/events");
  });

  it("stays on the screen when the delete fails", async () => {
    onDelete.mockRejectedValue(new Error("500"));
    await show(hikingEvent({ myRole: "Organizer", permissions: ALL_HOST_PERMISSIONS }));

    await choose("Ta bort evenemanget");
    await fireEvent.press(screen.getByTestId("event-delete-dialog-confirm"));
    await settle();

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

it("opens the report form when a participant reports the event", async () => {
  await show(hikingEvent({ myRole: "Participant", imageIdentifier: "img" }));

  await choose("Rapportera evenemanget");
  await flushUntil(() => screen.queryByTestId("report-submit") !== null);
  expect(screen.queryByTestId("report-submit")).not.toBeNull();
});
