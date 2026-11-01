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

jest.mock("@react-navigation/bottom-tabs", () => ({ useBottomTabBarHeight: () => 0 }));

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
  renderWithProviders(<EventBoardScreen />, {
    initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
  });
  await flushUntil(() => screen.queryByTestId("event-board-posts") !== null);
}

async function startEditing() {
  fireEvent.press(screen.getByTestId("event-post-menu-p1"));
  await flushUntil(() => screen.queryByText("Redigera") !== null);
  fireEvent.press(screen.getByText("Redigera"));
  await flushUntil(() => screen.queryByTestId("event-post-editing") !== null);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("EventBoardScreen", () => {
  it("sends a post and clears the draft", async () => {
    mockCreatePost.mockResolvedValue(post({ identifier: "p2", body: "Hej" }));
    await show([]);

    fireEvent.changeText(screen.getByTestId("event-post-input"), "Hej");
    fireEvent.press(screen.getByTestId("event-post-send"));
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
    fireEvent.changeText(screen.getByTestId("event-post-input"), "Vi ses vid stugan");
    fireEvent.press(screen.getByTestId("event-post-send"));
    await flushUntil(() => mockUpdatePost.mock.calls.length > 0);

    expect(mockUpdatePost).toHaveBeenCalledWith("p1", "Vi ses vid stugan");
    expect(mockCreatePost).not.toHaveBeenCalled();
    await flushUntil(() => screen.queryByTestId("event-post-editing") === null);
    expect(screen.queryByTestId("event-post-editing")).toBeNull();
  });

  it("keeps an unsent draft apart from the edit", async () => {
    await show();
    fireEvent.changeText(screen.getByTestId("event-post-input"), "Halvfärdigt");
    await startEditing();

    fireEvent.press(screen.getByTestId("event-post-edit-cancel"));
    await flushUntil(() => screen.queryByTestId("event-post-editing") === null);

    expect(screen.getByTestId("event-post-input").props.value).toBe("Halvfärdigt");
  });

  it("keeps the edited text when saving fails for another reason", async () => {
    mockUpdatePost.mockRejectedValue(new ApiError("HTTP error: updateEventPost: 500", 500));
    await show();
    await startEditing();

    fireEvent.changeText(screen.getByTestId("event-post-input"), "Ny text");
    fireEvent.press(screen.getByTestId("event-post-send"));
    await flushUntil(() => mockUpdatePost.mock.calls.length > 0);
    await settle();

    expect(screen.queryByTestId("event-post-editing")).not.toBeNull();
    expect(screen.getByTestId("event-post-input").props.value).toBe("Ny text");
  });

  it("ends the edit when the post is gone", async () => {
    mockUpdatePost.mockRejectedValue(new ApiError("HTTP error: updateEventPost: 404", 404, "post_gone"));
    await show();
    await startEditing();

    fireEvent.changeText(screen.getByTestId("event-post-input"), "Ny text");
    fireEvent.press(screen.getByTestId("event-post-send"));

    await flushUntil(() => screen.queryByTestId("event-post-editing") === null);
    expect(screen.queryByTestId("event-post-editing")).toBeNull();
  });

  it("offers no edit on someone else's post", async () => {
    await show([post({ isMine: false, canEdit: false, canDelete: false, authorIdentifier: "u2" })]);

    fireEvent.press(screen.getByTestId("event-post-menu-p1"));
    await flushUntil(() => screen.queryByText("Rapportera") !== null);

    expect(screen.queryByText("Redigera")).toBeNull();
  });
});
