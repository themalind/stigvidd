// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailObstacleItem from "@/components/trail/obstacle/trail-obstacle-item";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { TrailObstacle } from "@/data/types";
import { flushUntilGone, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockAddVote = jest.fn();
const mockDeleteVote = jest.fn();
const mockDeleteObstacle = jest.fn();
const mockNavigate = jest.fn();

jest.mock("@/api/trail-obstacles", () => ({
  addSolvedVote: (...args: unknown[]) => mockAddVote(...args),
  deleteSolvedVote: (...args: unknown[]) => mockDeleteVote(...args),
  deleteTrailObstacle: (...args: unknown[]) => mockDeleteObstacle(...args),
}));

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

// The report form is a modal with its own suite; what this item decides is what it opens.
jest.mock("@/components/report/report-content-form", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({
      visible,
      contentType,
      contentIdentifier,
    }: {
      visible: boolean;
      contentType: string;
      contentIdentifier: string;
    }) =>
      visible
        ? ReactActual.createElement(Text, { testID: "report-form" }, `${contentType}:${contentIdentifier}`)
        : null,
  };
});

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me" } }) };
});

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

// The update form is a modal with its own suite; what this item decides is what it opens with.
jest.mock("@/components/trail/obstacle/trail-obstacle-update-form", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({
      visible,
      obstacleIdentifier,
      trailIdentifier,
      initialDescription,
      initialIssueType,
    }: {
      visible: boolean;
      obstacleIdentifier: string;
      trailIdentifier: string;
      initialDescription: string;
      initialIssueType: string;
    }) =>
      visible
        ? ReactActual.createElement(
            Text,
            { testID: "update-form" },
            `${obstacleIdentifier}|${trailIdentifier}|${initialDescription}|${initialIssueType}`,
          )
        : null,
  };
});

const TRAIL_ID = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";
const OBSTACLE_ID = "b7e1a3d2-8c44-4a1f-9f21-5c6d7e8f9a01";

function obstacle(overrides: Partial<TrailObstacle> = {}): TrailObstacle {
  return {
    identifier: OBSTACLE_ID,
    userIdentifier: "someone-else",
    description: "Ett träd ligger över spången.",
    issueType: "FallenTree",
    createdAt: "2026-04-12T08:30:00Z",
    solvedVotes: [],
    ...overrides,
  };
}

const onCloseModal = jest.fn();

function show(o: TrailObstacle = obstacle(), theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(
    <TrailObstacleItem obstacle={o} trailIdentifier={TRAIL_ID} onCloseModal={onCloseModal} />,
    { theme },
  );
}

async function press(testID: string) {
  fireEvent.press(screen.getByTestId(testID));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockAddVote.mockResolvedValue({ success: true });
  mockDeleteVote.mockResolvedValue({ success: true });
  mockDeleteObstacle.mockResolvedValue({ success: true });
});

it("shows the category, the description and the day it was reported", () => {
  show();

  expect(screen.getByText("Nedfallet träd")).toBeTruthy();
  expect(screen.getByText("Ett träd ligger över spången.")).toBeTruthy();
  expect(screen.getByText("2026-04-12")).toBeTruthy();
});

// The description is cleared rather than the report deleted when it is moderated away.
it("says the description is gone rather than leaving the field blank", () => {
  show(obstacle({ description: "" }));

  expect(screen.getByText("Beskrivningen är borttagen")).toBeTruthy();
});

it("falls back to the catch-all category for a type the app does not know", () => {
  show(obstacle({ issueType: "Meteorstrike" }));

  expect(screen.getByText("Annat")).toBeTruthy();
});

it("counts the votes towards the three that clear the warning", () => {
  show(
    obstacle({
      solvedVotes: [
        { userIdentifier: "a", trailObstacleIdentifier: OBSTACLE_ID },
        { userIdentifier: "b", trailObstacleIdentifier: OBSTACLE_ID },
      ],
    }),
  );

  expect(screen.getByText("2/3")).toBeTruthy();
});

it("counts an obstacle nobody has voted on as zero", () => {
  show(obstacle({ solvedVotes: undefined }));

  expect(screen.getByText("0/3")).toBeTruthy();
});

it("lets the reporter edit and delete, and not vote on their own report", () => {
  show(obstacle({ userIdentifier: "me" }));

  expect(screen.getByTestId("icon-edit")).toBeTruthy();
  expect(screen.getByTestId("icon-delete-outline")).toBeTruthy();
  expect(screen.queryByTestId("icon-radio-button-unchecked")).toBeNull();
});

it("lets everyone else vote, and not edit or delete", () => {
  show();

  expect(screen.getByTestId("icon-radio-button-unchecked")).toBeTruthy();
  expect(screen.queryByTestId("icon-edit")).toBeNull();
  expect(screen.queryByTestId("icon-delete-outline")).toBeNull();
});

// userIdentifier is null once the reporter has deleted their account: nobody owns it then.
it("gives an orphaned report no owner actions", () => {
  show(obstacle({ userIdentifier: null }));

  expect(screen.queryByTestId("icon-edit")).toBeNull();
  expect(screen.getByTestId("icon-radio-button-unchecked")).toBeTruthy();
});

it("asks an anonymous visitor to log in instead of registering a vote", async () => {
  mockIsAuthenticated = false;
  show();

  await press("icon-radio-button-unchecked");

  expect(screen.getByText("Du behöver vara inloggad för att markera ett hinder som löst.")).toBeTruthy();
  expect(mockAddVote).not.toHaveBeenCalled();
});

// The dialog sits inside a modal that has to close before the login screen can be seen.
it("closes the obstacle modal on the way to the login screen", async () => {
  mockIsAuthenticated = false;
  show();

  await press("icon-radio-button-unchecked");
  fireEvent.press(screen.getByText("Logga in"));
  await settle();

  expect(onCloseModal).toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(profile-stack)/login");
});

it("confirms before marking an obstacle as solved", async () => {
  show();

  await press("icon-radio-button-unchecked");

  expect(screen.getByText("Hinder åtgärdat")).toBeTruthy();
  expect(mockAddVote).not.toHaveBeenCalled();
});

it("registers the vote on this obstacle once confirmed", async () => {
  show();

  await press("icon-radio-button-unchecked");
  fireEvent.press(screen.getByText("Ok"));
  await settle();

  expect(mockAddVote).toHaveBeenCalledWith(OBSTACLE_ID);
});

it("registers nothing when the confirmation is cancelled, and closes the dialog", async () => {
  show();

  await press("icon-radio-button-unchecked");
  fireEvent.press(screen.getByText("Avbryt"));
  await flushUntilGone(() => screen.queryByText("Hinder åtgärdat"));

  expect(mockAddVote).not.toHaveBeenCalled();
  expect(screen.queryByText("Hinder åtgärdat")).toBeNull();
});

it("marks the obstacle as one you have already voted on", () => {
  show(obstacle({ solvedVotes: [{ userIdentifier: "me", trailObstacleIdentifier: OBSTACLE_ID }] }));

  expect(screen.getByTestId("icon-check-circle")).toBeTruthy();
  expect(screen.queryByTestId("icon-radio-button-unchecked")).toBeNull();
});

// Someone else's vote is not yours: the button still offers to add one.
it("does not treat another user's vote as yours", () => {
  show(obstacle({ solvedVotes: [{ userIdentifier: "not-me", trailObstacleIdentifier: OBSTACLE_ID }] }));

  expect(screen.getByTestId("icon-radio-button-unchecked")).toBeTruthy();
});

it("takes back your vote after confirming, rather than voting twice", async () => {
  show(obstacle({ solvedVotes: [{ userIdentifier: "me", trailObstacleIdentifier: OBSTACLE_ID }] }));

  await press("icon-check-circle");
  expect(screen.getByText("Ta bort markering")).toBeTruthy();

  fireEvent.press(screen.getByText("Ta bort"));
  await settle();

  expect(mockDeleteVote).toHaveBeenCalledWith(OBSTACLE_ID);
  expect(mockAddVote).not.toHaveBeenCalled();
});

it("keeps your vote when you back out of taking it back", async () => {
  show(obstacle({ solvedVotes: [{ userIdentifier: "me", trailObstacleIdentifier: OBSTACLE_ID }] }));

  await press("icon-check-circle");
  fireEvent.press(screen.getByText("Avbryt"));
  await flushUntilGone(() => screen.queryByText("Ta bort markering"));

  expect(mockDeleteVote).not.toHaveBeenCalled();
  expect(screen.queryByText("Ta bort markering")).toBeNull();
});

it("warns that deleting the report cannot be undone", async () => {
  show(obstacle({ userIdentifier: "me" }));

  await press("icon-delete-outline");

  expect(screen.getByText("Är du säker på att du vill ta bort den här rapporten?")).toBeTruthy();
  expect(screen.getByText("Åtgärden kan inte ångras.")).toBeTruthy();
  expect(mockDeleteObstacle).not.toHaveBeenCalled();
});

it("deletes the report it was opened on once confirmed", async () => {
  show(obstacle({ userIdentifier: "me" }));

  await press("icon-delete-outline");
  fireEvent.press(screen.getByText("Ta bort"));
  await settle();

  expect(mockDeleteObstacle).toHaveBeenCalledWith(OBSTACLE_ID);
});

it("deletes nothing when the confirmation is cancelled, and closes the dialog", async () => {
  show(obstacle({ userIdentifier: "me" }));

  await press("icon-delete-outline");
  fireEvent.press(screen.getByText("Avbryt"));
  await flushUntilGone(() => screen.queryByText("Åtgärden kan inte ångras."));

  expect(mockDeleteObstacle).not.toHaveBeenCalled();
  expect(screen.queryByText("Åtgärden kan inte ångras.")).toBeNull();
});

it("opens the edit form on this report, filled in with what it says now", async () => {
  show(obstacle({ userIdentifier: "me" }));

  expect(screen.queryByTestId("update-form")).toBeNull();

  await press("icon-edit");

  expect(screen.getByTestId("update-form")).toHaveTextContent(
    `${OBSTACLE_ID}|${TRAIL_ID}|Ett träd ligger över spången.|FallenTree`,
  );
});

// A second press while the vote is in flight would send it twice.
it("greys the vote button out while the vote is on its way", async () => {
  let release: (value: { success: boolean }) => void = () => {};
  mockAddVote.mockReturnValue(new Promise<{ success: boolean }>((resolve) => (release = resolve)));
  show();

  await press("icon-radio-button-unchecked");
  fireEvent.press(screen.getByText("Ok"));
  await settle();

  expect(screen.getByTestId("icon-radio-button-unchecked").props.color).toBe(AppDefaultTheme.colors.outline);
  expect(screen.getByTestId("vote-button").props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.press(screen.getByTestId("vote-button"));
  expect(mockAddVote).toHaveBeenCalledTimes(1);

  release({ success: true });
  await settle();
});

it("draws the vote button in the accent colour until it is pressed", () => {
  show();

  expect(screen.getByTestId("icon-radio-button-unchecked").props.color).toBe(AppDefaultTheme.colors.tertiary);
});

it("sits in a rounded, outlined card, in both themes", () => {
  const light = show();

  expect(screen.getByTestId("obstacle-card")).toHaveStyle({
    borderWidth: 1,
    borderRadius: 5,
    padding: 12,
    gap: 10,
    borderColor: AppDefaultTheme.colors.outlineVariant,
  });
  light.unmount();

  show(obstacle(), AppDarkTheme);

  expect(screen.getByTestId("obstacle-card")).toHaveStyle({ borderColor: AppDarkTheme.colors.outlineVariant });
});

it("offers to report someone else's obstacle, and opens the form on that obstacle", async () => {
  show();

  await press("report-obstacle-button");

  expect(screen.getByTestId("report-form")).toHaveTextContent(`TrailObstacle:${OBSTACLE_ID}`);
});

// Reports stored before the form trimmed carry trailing newlines, which render as blank
// lines and leave a gap between the description and the date.
// The default matcher collapses whitespace, so the raw string is what has to be asserted.
it("draws a stored description without the blank lines around it", () => {
  show(obstacle({ description: "\n  Oframkomligt pga lerhav\n\n\n" }));

  const verbatim = { normalizer: (text: string) => text };

  expect(screen.getByText("Oframkomligt pga lerhav", verbatim)).toBeTruthy();
});

// Reporting is one action wherever it appears, so the obstacle uses the review's icon.
it("reports with the same icon as a review report", () => {
  show();

  expect(screen.getByTestId("icon-alert-circle")).toBeTruthy();
  expect(screen.queryByTestId("icon-flag")).toBeNull();
});

// Both buttons carry hitSlop 12, so a gap under 24 makes their touch areas overlap and a
// thumb aimed at one lands on the other.
it("keeps the report and the vote far enough apart not to overlap", () => {
  show();

  expect(screen.getByTestId("obstacle-actions")).toHaveStyle({ gap: 24 });
});

// Nobody reports their own report; the owner gets edit and delete instead.
it("offers the owner no report button", () => {
  show(obstacle({ userIdentifier: "me" }));

  expect(screen.queryByTestId("report-obstacle-button")).toBeNull();
});

it("asks a signed-out visitor to sign in instead of opening the form", async () => {
  mockIsAuthenticated = false;
  show();

  await press("report-obstacle-button");

  expect(screen.queryByTestId("report-form")).toBeNull();
  expect(screen.getByText("Du är inte inloggad")).toBeTruthy();
});
