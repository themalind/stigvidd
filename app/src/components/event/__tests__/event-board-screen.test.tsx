// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { userAtom } from "@/atoms/auth-atoms";
import EventBoardScreen from "@/components/event/event-board-screen";
import { EventBoard, EventPost, HikingEvent } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { FlatList } from "react-native";

const mockGetEvent = jest.fn();
const mockGetPosts = jest.fn();
const mockCreatePost = jest.fn();
const mockUpdatePost = jest.fn();

jest.mock("@/api/events", () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getEventPosts: (...args: unknown[]) => mockGetPosts(...args),
  createEventPost: (...args: unknown[]) => mockCreatePost(...args),
  updateEventPost: (...args: unknown[]) => mockUpdatePost(...args),
  markEventPostsRead: () => Promise.resolve(),
  deleteEventPost: jest.fn(),
  setEventPostPinned: jest.fn(),
  setEventMuted: jest.fn(),
}));

jest.mock("@/api/content-reports", () => ({
  getReportReasons: () => Promise.resolve(["Spam"]),
  createContentReport: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ identifier: "e1" }),
  router: { navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

jest.mock("expo-router/js-tabs", () => ({ useBottomTabBarHeight: () => 0 }));

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: true, logout: jest.fn() }),
}));

const PERMISSIONS = {
  canEdit: false,
  canCancel: false,
  canDelete: false,
  canInvite: false,
  canJoin: false,
  canMarkInterested: false,
  canChangeRoles: false,
  canRemoveParticipants: false,
  canPinOrDeletePosts: false,
  canReadBoard: true,
  canPost: true,
};

const EVENT: HikingEvent = {
  identifier: "e1",
  title: "Kvällsvandring",
  description: "",
  startsAt: "2026-11-05T17:30:00Z",
  participantCount: 3,
  interestedCount: 0,
  visibility: "Open",
  allowParticipantInvites: false,
  status: "Published",
  isPast: false,
  hasPendingInvite: false,
  myStatus: "Joined",
  permissions: PERMISSIONS,
};

function post(overrides: Partial<EventPost> = {}): EventPost {
  return {
    identifier: "p1",
    authorIdentifier: "me",
    authorNickName: "jag",
    body: "Vi ses vid parkeringen",
    isPinned: false,
    createdAt: "2026-11-01T10:00:00Z",
    isMine: true,
    canEdit: true,
    canDelete: true,
    ...overrides,
  };
}

function board(posts: EventPost[]): EventBoard {
  return { pinned: [], posts, nextCursor: null, lastReadPostAt: "2026-11-01T11:00:00Z", muted: false };
}

async function show(posts: EventPost[] = [post()]) {
  mockGetEvent.mockResolvedValue(EVENT);
  mockGetPosts.mockResolvedValue(board(posts));
  await renderWithProviders(<EventBoardScreen />, {
    initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
  });
  await flushUntil(() => screen.queryByTestId("event-board-posts") !== null);
}

async function startEditing() {
  await fireEvent.press(screen.getByTestId("event-post-menu-p1"));
  await flushUntil(() => screen.queryByText("Redigera") !== null);
  await fireEvent.press(screen.getByText("Redigera"));
  await flushUntil(() => screen.queryByTestId("event-post-editing") !== null);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("EventBoardScreen", () => {
  it("keeps the way back on the error screen of a board that failed to load", async () => {
    mockGetEvent.mockResolvedValue(EVENT);
    mockGetPosts.mockRejectedValue(new ApiError("HTTP error: getEventPosts: 500", 500));
    await renderWithProviders(<EventBoardScreen />);

    await flushUntil(() => screen.queryByText("Försök igen") !== null);
    expect(screen.getByTestId("back-button")).toBeTruthy();
  });

  it("sends a post and clears the draft", async () => {
    mockCreatePost.mockResolvedValue(post({ identifier: "p2", body: "Hej" }));
    await show([]);

    await fireEvent.changeText(screen.getByTestId("event-post-input"), "Hej");
    await fireEvent.press(screen.getByTestId("event-post-send"));
    await flushUntil(() => mockCreatePost.mock.calls.length > 0);

    expect(mockCreatePost).toHaveBeenCalledWith("e1", "Hej");
    await flushUntil(() => screen.getByTestId("event-post-input").props.value === "");
    expect(screen.getByTestId("event-post-input").props.value).toBe("");
  });

  it("edits one's own post in the write box and leaves edit mode when saved", async () => {
    mockUpdatePost.mockResolvedValue(post({ body: "Vi ses vid stugan" }));
    await show();
    await startEditing();

    expect(screen.getByTestId("event-post-input").props.value).toBe("Vi ses vid parkeringen");
    await fireEvent.changeText(screen.getByTestId("event-post-input"), "Vi ses vid stugan");
    await fireEvent.press(screen.getByTestId("event-post-send"));
    await flushUntil(() => mockUpdatePost.mock.calls.length > 0);

    expect(mockUpdatePost).toHaveBeenCalledWith("p1", "Vi ses vid stugan");
    expect(mockCreatePost).not.toHaveBeenCalled();
    await flushUntil(() => screen.queryByTestId("event-post-editing") === null);
    expect(screen.queryByTestId("event-post-editing")).toBeNull();
  });

  it("keeps an unsent draft apart from the edit", async () => {
    await show();
    await fireEvent.changeText(screen.getByTestId("event-post-input"), "Halvfärdigt");
    await startEditing();

    await fireEvent.press(screen.getByTestId("event-post-edit-cancel"));
    await flushUntil(() => screen.queryByTestId("event-post-editing") === null);

    expect(screen.getByTestId("event-post-input").props.value).toBe("Halvfärdigt");
  });

  it("keeps the edited text when saving fails for another reason", async () => {
    mockUpdatePost.mockRejectedValue(new ApiError("HTTP error: updateEventPost: 500", 500));
    await show();
    await startEditing();

    await fireEvent.changeText(screen.getByTestId("event-post-input"), "Ny text");
    await fireEvent.press(screen.getByTestId("event-post-send"));
    await flushUntil(() => mockUpdatePost.mock.calls.length > 0);
    await settle();

    expect(screen.queryByTestId("event-post-editing")).not.toBeNull();
    expect(screen.getByTestId("event-post-input").props.value).toBe("Ny text");
  });

  it("ends the edit when the post is gone", async () => {
    mockUpdatePost.mockRejectedValue(new ApiError("HTTP error: updateEventPost: 404", 404, "post_gone"));
    await show();
    await startEditing();

    await fireEvent.changeText(screen.getByTestId("event-post-input"), "Ny text");
    await fireEvent.press(screen.getByTestId("event-post-send"));

    await flushUntil(() => screen.queryByTestId("event-post-editing") === null);
    expect(screen.queryByTestId("event-post-editing")).toBeNull();
  });

  it("labels the pinned box and scrolls to the pinned post when it is pressed", async () => {
    const scrollToIndex = jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => undefined);
    const pinnedPost = post({
      identifier: "p2",
      body: "Samling 07.45",
      isPinned: true,
      createdAt: "2026-11-01T09:00:00Z",
    });
    mockGetEvent.mockResolvedValue(EVENT);
    mockGetPosts.mockResolvedValue({ ...board([pinnedPost, post()]), pinned: [pinnedPost] });
    await renderWithProviders(<EventBoardScreen />, {
      initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
    });
    await flushUntil(() => screen.queryByTestId("event-board-pins-toggle") !== null);
    await fireEvent.press(screen.getByTestId("event-board-pins-toggle"));
    await flushUntil(() => screen.queryByTestId("event-pinned-p2") !== null);

    expect(screen.getByTestId("event-board-pinned")).toHaveTextContent(/Fäst/);
    await fireEvent.press(screen.getByTestId("event-pinned-p2"));
    await flushUntil(() => scrollToIndex.mock.calls.length > 0);

    expect(scrollToIndex).toHaveBeenCalledWith({ index: 1, viewPosition: 0.5 });
    scrollToIndex.mockRestore();
  });

  it("keeps the pinned box closed behind a counted pin until the pin is pressed, and closes it again", async () => {
    const pinnedPost = post({ identifier: "p2", body: "Samling 07.45", isPinned: true });
    mockGetEvent.mockResolvedValue(EVENT);
    mockGetPosts.mockResolvedValue({ ...board([pinnedPost, post()]), pinned: [pinnedPost] });
    await renderWithProviders(<EventBoardScreen />, {
      initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
    });
    await flushUntil(() => screen.queryByTestId("event-board-pins-toggle") !== null);

    const toggle = screen.getByTestId("event-board-pins-toggle");
    expect(screen.queryByTestId("event-board-pinned")).toBeNull();
    expect(toggle.props.accessibilityLabel).toBe("Visa fästa inlägg (1)");

    await fireEvent.press(toggle);
    await flushUntil(() => screen.queryByTestId("event-board-pinned") !== null);
    expect(screen.getByTestId("event-board-pinned")).toHaveTextContent(/Samling 07.45/);

    await fireEvent.press(screen.getByTestId("event-board-pins-toggle"));
    await flushUntil(() => screen.queryByTestId("event-board-pinned") === null);
    expect(screen.queryByTestId("event-board-pinned")).toBeNull();
  });

  it("shows no pin in the top bar when nothing is pinned", async () => {
    await show([post()]);

    expect(screen.queryByTestId("event-board-pins-toggle")).toBeNull();
  });

  it("loads older pages until a pressed pin that is not loaded yet appears", async () => {
    const scrollToIndex = jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => undefined);
    const oldPin = post({ identifier: "old", body: "Gammal info", isPinned: true, createdAt: "2026-10-30T09:00:00Z" });
    mockGetEvent.mockResolvedValue(EVENT);
    mockGetPosts
      .mockResolvedValueOnce({ ...board([post()]), pinned: [oldPin], nextCursor: "c1" })
      .mockResolvedValueOnce({ ...board([oldPin]), pinned: [oldPin] });
    await renderWithProviders(<EventBoardScreen />, {
      initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
    });
    await flushUntil(() => screen.queryByTestId("event-board-pins-toggle") !== null);
    await fireEvent.press(screen.getByTestId("event-board-pins-toggle"));
    await flushUntil(() => screen.queryByTestId("event-pinned-old") !== null);

    await fireEvent.press(screen.getByTestId("event-pinned-old"));
    await flushUntil(() => scrollToIndex.mock.calls.length > 0);

    expect(mockGetPosts).toHaveBeenCalledTimes(2);
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 1, viewPosition: 0.5 });
    scrollToIndex.mockRestore();
  });

  it("offers no edit on someone else's post", async () => {
    await show([post({ isMine: false, canEdit: false, canDelete: false, authorIdentifier: "u2" })]);

    await fireEvent.press(screen.getByTestId("event-post-menu-p1"));
    await flushUntil(() => screen.queryByText("Rapportera") !== null);

    expect(screen.queryByText("Redigera")).toBeNull();
  });
});
