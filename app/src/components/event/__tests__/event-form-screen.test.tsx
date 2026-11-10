// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userAtom } from "@/atoms/auth-atoms";
import EventFormScreen from "@/components/event/event-form-screen";
import { HikingEvent } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

type DateProps = { visible: boolean; onConfirm: (value: { date: Date }) => void };
type TimeProps = { visible: boolean; onConfirm: (value: { hours: number; minutes: number }) => void };
let mockDateProps: DateProps | null = null;
let mockTimeProps: TimeProps | null = null;

jest.mock("react-native-paper-dates", () => ({
  registerTranslation: jest.fn(),
  sv: {},
  en: {},
  DatePickerModal: (props: DateProps) => {
    if (props.visible) mockDateProps = props;
    return null;
  },
  TimePickerModal: (props: TimeProps) => {
    if (props.visible) mockTimeProps = props;
    return null;
  },
}));

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockGetEvent = jest.fn();
const mockInvite = jest.fn();

jest.mock("@/api/events", () => ({
  createEvent: (...args: unknown[]) => mockCreate(...args),
  updateEvent: (...args: unknown[]) => mockUpdate(...args),
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  inviteToEvent: (...args: unknown[]) => mockInvite(...args),
  setEventImage: (...args: unknown[]) => mockSetImage(...args),
  deleteEventImage: (...args: unknown[]) => mockDeleteImage(...args),
}));

const mockSetImage = jest.fn();
const mockDeleteImage = jest.fn();
const mockPickImages = jest.fn();
jest.mock("@/utils/image/pick-images", () => ({ pickImages: (...args: unknown[]) => mockPickImages(...args) }));

jest.mock("@/api/trails", () => ({
  getAllTrails: () =>
    Promise.resolve([
      {
        identifier: "t1",
        name: "Rya åsar",
        trailLength: 4.5,
        city: "Borås",
        accessibility: false,
        classification: 1,
        averageRating: 0,
      },
    ]),
}));

jest.mock("@/api/friends", () => ({
  getFriends: () => Promise.resolve([{ identifier: "u2", nickName: "maja" }]),
  searchUsers: () => Promise.resolve([]),
}));

let mockParams: { identifier?: string } = {};
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: () => mockBack(),
    navigate: jest.fn(),
    canGoBack: () => true,
  },
}));

jest.mock("@/utils/navigation", () => ({ guardedNavigate: (fn: () => void) => fn() }));

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: true, logout: jest.fn() }),
}));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me", nickName: "jag" } }) };
});

const TOMORROW = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

async function render() {
  await renderWithProviders(<EventFormScreen />, {
    initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
  });
  await flushUntil(() => screen.queryByTestId("event-form-submit") !== null);
}

async function pickStart() {
  await fireEvent.press(screen.getByTestId("event-form-starts"));
  await settle();
  const date = mockDateProps;
  if (!date) throw new Error("expected the date picker");
  await act(() => date.onConfirm({ date: TOMORROW }));
  await settle();
  const time = mockTimeProps;
  if (!time) throw new Error("expected the time picker");
  await act(() => time.onConfirm({ hours: 18, minutes: 30 }));
  await settle();
}

async function tapMap(lon: number, lat: number) {
  await fireEvent(screen.getByTestId("maplibre-Map"), "press", { nativeEvent: { lngLat: [lon, lat] } });
}

function created(overrides: Partial<HikingEvent> = {}): HikingEvent {
  return {
    identifier: "new-1",
    title: "Kvällsvandring",
    description: "",
    startsAt: TOMORROW.toISOString(),
    participantCount: 1,
    interestedCount: 0,
    visibility: "Open",
    allowParticipantInvites: false,
    status: "Published",
    isPast: false,
    hasPendingInvite: false,
    myRole: "Organizer",
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

beforeEach(() => {
  jest.clearAllMocks();
  mockPickImages.mockResolvedValue(["file://picked.jpg"]);
  mockParams = {};
  mockDateProps = null;
  mockTimeProps = null;
  mockCreate.mockResolvedValue(created());
  mockUpdate.mockResolvedValue(created());
  mockInvite.mockResolvedValue(undefined);
});

describe("EventFormScreen", () => {
  it("shows what is missing and sends nothing", async () => {
    await render();

    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await settle();

    expect(screen.getByText("Ge evenemanget en titel.")).toBeTruthy();
    expect(screen.getByText("Välj när evenemanget börjar.")).toBeTruthy();
    expect(screen.getByText("Välj en led, en hike eller en samlingsplats.")).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates an open event at a tapped meeting point and opens it in place of the form", async () => {
    await render();

    await fireEvent.changeText(screen.getByTestId("event-form-title"), "Kvällsvandring");
    await pickStart();
    await tapMap(12.94, 57.72);
    await settle();
    await fireEvent.changeText(screen.getByTestId("event-form-meeting-name"), "Parkeringen");
    await fireEvent.changeText(screen.getByTestId("event-form-max"), "8");
    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockReplace.mock.calls.length > 0);

    const request = mockCreate.mock.calls[0][0];
    expect(request).toMatchObject({
      title: "Kvällsvandring",
      visibility: "Open",
      meetingPointLongitude: 12.94,
      meetingPointLatitude: 57.72,
      meetingPointName: "Parkeringen",
      maxParticipants: 8,
    });
    const start = new Date(request.startsAt);
    expect([start.getHours(), start.getMinutes(), start.getDate()]).toEqual([18, 30, TOMORROW.getDate()]);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/(tabs)/events/event/[identifier]",
      params: { identifier: "new-1" },
    });
  });

  it("sends the same key when a failed create is sent again", async () => {
    mockCreate.mockRejectedValueOnce(new Error("offline"));
    await render();

    await fireEvent.changeText(screen.getByTestId("event-form-title"), "Kvällsvandring");
    await pickStart();
    await tapMap(12.94, 57.72);
    await settle();
    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockCreate.mock.calls.length === 1);
    await settle();
    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockReplace.mock.calls.length > 0);

    const [[first], [retry]] = mockCreate.mock.calls;
    expect(first.clientRequestId).toEqual(expect.any(String));
    expect(retry.clientRequestId).toBe(first.clientRequestId);
  });

  it("follows a trail picked from the route picker", async () => {
    await render();
    await fireEvent.changeText(screen.getByTestId("event-form-title"), "Kvällsvandring");
    await pickStart();

    await fireEvent.press(screen.getByTestId("event-form-choose-route"));
    await flushUntil(() => screen.queryByTestId("event-route-trail-t1") !== null);
    await fireEvent.press(screen.getByTestId("event-route-trail-t1"));
    await flushUntil(() => screen.queryByTestId("event-form-route") !== null);
    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockCreate.mock.calls.length > 0);

    expect(mockCreate.mock.calls[0][0]).toMatchObject({ trailIdentifier: "t1", hikeIdentifier: null });
  });

  it("invites the chosen people once a private event exists", async () => {
    await render();
    await fireEvent.changeText(screen.getByTestId("event-form-title"), "Kvällsvandring");
    await pickStart();
    await tapMap(12.94, 57.72);
    await fireEvent.press(screen.getByTestId("event-form-private"));
    await settle();

    await fireEvent.press(screen.getByTestId("event-form-choose-invitees"));
    await flushUntil(() => screen.queryByTestId("user-picker-row-maja") !== null);
    await fireEvent.press(screen.getByTestId("user-picker-row-maja"));
    await fireEvent.press(screen.getByText("Bjud in (1)"));
    await flushUntil(() => screen.queryByTestId("event-form-invitee-maja") !== null);

    expect(screen.getByText("Skapa och bjud in 1")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockInvite.mock.calls.length > 0);

    expect(mockCreate.mock.calls[0][0]).toMatchObject({ visibility: "Private" });
    expect(mockInvite).toHaveBeenCalledWith("new-1", ["maja"]);
  });

  it("edits without offering visibility and asks to drop a removed own route", async () => {
    mockParams = { identifier: "e1" };
    mockGetEvent.mockResolvedValue(
      created({
        identifier: "e1",
        meetingPointLongitude: 12.94,
        meetingPointLatitude: 57.72,
        route: { kind: "Own", lengthMeters: 3000 },
      }),
    );
    await render();
    await flushUntil(() => screen.queryByTestId("event-form-route") !== null);

    expect(screen.queryByTestId("event-form-private")).toBeNull();
    await fireEvent.press(screen.getByTestId("event-form-route-clear"));
    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockBack.mock.calls.length > 0);

    expect(mockUpdate).toHaveBeenCalledWith("e1", expect.objectContaining({ removeRoute: true }));
    expect(mockBack).toHaveBeenCalled();
  });

  it("uploads a picked cover with the framing the user dragged it to", async () => {
    mockSetImage.mockResolvedValue({ identifier: "img-1", imageUrl: "https://media/new.jpg" });
    await render();
    await fireEvent.changeText(screen.getByTestId("event-form-title"), "Kvällsvandring");
    await pickStart();
    await tapMap(12.94, 57.72);
    await fireEvent.press(screen.getByTestId("event-form-cover-add"));
    await flushUntil(() => screen.queryByTestId("event-form-cover-image") !== null);
    await act(async () => {
      await fireEvent(screen.getByTestId("event-form-cover"), "layout", {
        nativeEvent: { layout: { width: 300, height: 150 } },
      });
      screen
        .getByTestId("event-form-cover-image")
        .props.onLoad({ nativeEvent: { source: { width: 1000, height: 1000 } } });
    });
    const frame = screen.getByTestId("event-form-cover-frame");
    await fireEvent(frame, "responderGrant", { nativeEvent: { pageY: 100 } });
    await fireEvent(frame, "responderMove", { nativeEvent: { pageY: 160 } });
    await fireEvent(frame, "responderRelease");

    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockSetImage.mock.calls.length > 0);

    const [identifier, uri, focusY] = mockSetImage.mock.calls[0];
    expect(identifier).toBe("new-1");
    expect(uri).toBe("file://picked.jpg");
    expect(focusY).toBeCloseTo(0.1);
  });

  it("drops an unsaved cover without asking the server to delete one", async () => {
    await render();
    await fireEvent.changeText(screen.getByTestId("event-form-title"), "Kvällsvandring");
    await pickStart();
    await tapMap(12.94, 57.72);
    await fireEvent.press(screen.getByTestId("event-form-cover-add"));
    await flushUntil(() => screen.queryByTestId("event-form-cover-remove") !== null);
    expect(mockPickImages).toHaveBeenCalledWith({ limit: 1 });
    await fireEvent.press(screen.getByTestId("event-form-cover-remove"));
    await settle();

    expect(screen.getByTestId("event-form-cover-add")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockCreate.mock.calls.length > 0);
    await settle();

    expect(mockSetImage).not.toHaveBeenCalled();
    expect(mockDeleteImage).not.toHaveBeenCalled();
  });

  it("deletes a saved cover the user removed", async () => {
    mockParams = { identifier: "e1" };
    mockGetEvent.mockResolvedValue(
      created({
        identifier: "e1",
        meetingPointLongitude: 12.94,
        meetingPointLatitude: 57.72,
        imageUrl: "https://media/cover.jpg",
      }),
    );
    await render();
    await flushUntil(() => screen.queryByTestId("event-form-cover-remove") !== null);

    await fireEvent.press(screen.getByTestId("event-form-cover-remove"));
    await fireEvent.press(screen.getByTestId("event-form-submit"));
    await flushUntil(() => mockDeleteImage.mock.calls.length > 0);

    expect(mockDeleteImage).toHaveBeenCalledWith("new-1");
  });
});
