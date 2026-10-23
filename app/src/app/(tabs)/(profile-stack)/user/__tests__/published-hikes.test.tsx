// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import PublishedHikesScreen from "@/app/(tabs)/(profile-stack)/user/published-hikes";
import { HikeSubmission } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockGetSubmissions = jest.fn();
const mockWithdraw = jest.fn();
jest.mock("@/api/hike-submissions", () => ({
  getMyHikeSubmissions: () => mockGetSubmissions(),
  withdrawHikeSubmission: (...args: unknown[]) => mockWithdraw(...args),
}));

const mockGetHikes = jest.fn();
jest.mock("@/api/hikes", () => ({
  getAllHikesByUserId: () => mockGetHikes(),
}));

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), back: jest.fn() },
  useRouter: () => ({ navigate: mockNavigate, back: jest.fn() }),
}));

jest.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ isAuthenticated: true }) }));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me" } }) };
});

let clock = 9_000_000;

function submission(overrides: Partial<HikeSubmission>): HikeSubmission {
  return {
    identifier: "s1",
    name: "Kvällsrunda",
    trailLength: 4.9,
    status: "Pending",
    createdAt: "2026-10-15T10:00:00Z",
    likeCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWithdraw.mockResolvedValue(undefined);
  mockGetHikes.mockResolvedValue([]);
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function show(items: HikeSubmission[]) {
  mockGetSubmissions.mockResolvedValue(items);
  const rendered = renderWithProviders(<PublishedHikesScreen />);
  await flushUntil(() => screen.queryByText("Mina publicerade promenader"));
  await settle();
  return rendered;
}

it("shows each submission with its status, likes and the reason it was rejected", async () => {
  await show([
    submission({
      identifier: "a",
      name: "Ljungåsen runt",
      status: "Approved",
      likeCount: 234,
      publishedTrailIdentifier: "t1",
    }),
    submission({ identifier: "b", name: "Kvällsrunda", status: "Pending" }),
    submission({ identifier: "c", name: "Till jobbet", status: "Rejected", rejectionReason: "Mest gata" }),
  ]);

  expect(screen.getByText("Publicerad")).toBeTruthy();
  expect(screen.getByText("234")).toBeTruthy();
  expect(screen.getByText("Väntar på granskning")).toBeTruthy();
  expect(screen.getByText("Avslagen")).toBeTruthy();
  expect(screen.getByText(/Mest gata/)).toBeTruthy();
});

it("offers no withdraw on a published walk, which belongs to Stigvidd", async () => {
  await show([submission({ identifier: "a", status: "Approved", publishedTrailIdentifier: "t1" })]);

  expect(screen.queryByTestId("submission-withdraw-a")).toBeNull();
});

it("opens the published trail in the profile stack", async () => {
  await show([submission({ identifier: "a", status: "Approved", publishedTrailIdentifier: "t1" })]);

  fireEvent.press(screen.getByTestId("submission-a"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
    params: { identifier: "t1" },
  });
});

it("withdraws a pending submission after confirming", async () => {
  await show([submission({ identifier: "b" })]);

  fireEvent.press(screen.getByLabelText("Dra tillbaka"));
  expect(mockWithdraw).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Dra tillbaka"));
  await settle();

  expect(mockWithdraw).toHaveBeenCalledWith("b");
});

it("draws the walk's route when the submission has no photo", async () => {
  mockGetHikes.mockResolvedValue([
    {
      identifier: "h1",
      coordinates: JSON.stringify([
        { latitude: 57.72, longitude: 12.94 },
        { latitude: 57.73, longitude: 12.95 },
      ]),
    },
  ]);
  await show([submission({ identifier: "b", sourceHikeIdentifier: "h1" })]);
  await flushUntil(() => screen.queryByTestId("submission-route-b"));

  expect(screen.getByTestId("submission-route-b")).toBeTruthy();
  expect(screen.queryByTestId("route-thumbnail-fallback", { includeHiddenElements: true })).toBeNull();
});

it("falls back to an icon when the walk behind the submission is gone", async () => {
  mockGetHikes.mockResolvedValue([
    {
      identifier: "other-hike",
      coordinates: JSON.stringify([
        { latitude: 57.72, longitude: 12.94 },
        { latitude: 57.73, longitude: 12.95 },
      ]),
    },
  ]);
  await show([submission({ identifier: "b", sourceHikeIdentifier: "deleted-hike" })]);
  await settle();

  expect(screen.getByTestId("submission-route-b")).toBeTruthy();
  expect(screen.getByTestId("route-thumbnail-fallback", { includeHiddenElements: true })).toBeTruthy();
});

it("explains how to publish when there is nothing yet", async () => {
  await show([]);

  expect(
    screen.getByText("Du har inte publicerat några promenader än. Öppna en av dina promenader och tryck på Publicera."),
  ).toBeTruthy();
});
