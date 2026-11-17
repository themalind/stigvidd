// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { AWAY_BEFORE_RECORDER_MS, RECORDER_ROUTE, useOpenActiveRecording } from "@/hooks/hike/useOpenActiveRecording";
import { flushUntil } from "@/test/flush";
import { renderHook } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";

const mockNavigate = jest.fn();
const mockIsReady = jest.fn();
const mockPathname = jest.fn();
const mockReadHikeState = jest.fn();
const mockNavigationRef = { isReady: () => mockIsReady() };

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useNavigationContainerRef: () => mockNavigationRef,
  usePathname: () => mockPathname(),
}));

jest.mock("@/services/location-task", () => ({
  readHikeState: () => mockReadHikeState(),
}));

const NOW = 1_757_000_000_000;
let clock = NOW;
let onAppState: ((state: AppStateStatus) => void) | null = null;

function recording(isTracking: boolean) {
  mockReadHikeState.mockResolvedValue({ isTracking });
}

// The navigate waits on frames, so a negative case runs every tick before it is believed. keep-comment: why not settle()
async function flush() {
  await flushUntil(() => mockNavigate.mock.calls.length > 0, 10);
}

async function mount(signedIn = true) {
  const rendered = await renderHook(() => useOpenActiveRecording(signedIn));
  await flush();
  return rendered;
}

async function leaveFor(ms: number) {
  onAppState?.("background");
  clock += ms;
  onAppState?.("active");
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  clock = NOW;
  onAppState = null;
  mockIsReady.mockReturnValue(true);
  mockPathname.mockReturnValue("/");
  recording(true);
  jest.spyOn(Date, "now").mockImplementation(() => clock);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    onAppState = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("opens the recorder on start while a hike is recording", async () => {
  await mount();

  expect(mockNavigate).toHaveBeenCalledWith(RECORDER_ROUTE, { withAnchor: true });
});

it("stays put when nothing is recording", async () => {
  recording(false);

  await mount();

  expect(mockNavigate).not.toHaveBeenCalled();
});

it("does not stack a second recorder on the one already open", async () => {
  mockPathname.mockReturnValue("/user/create-hike");

  await mount();

  expect(mockNavigate).not.toHaveBeenCalled();
});

it("leaves a signed-out user alone", async () => {
  await mount(false);

  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockReadHikeState).not.toHaveBeenCalled();
});

it("opens the recorder after a long time away", async () => {
  await mount();
  mockNavigate.mockClear();

  await leaveFor(AWAY_BEFORE_RECORDER_MS);

  expect(mockNavigate).toHaveBeenCalledWith(RECORDER_ROUTE, { withAnchor: true });
});

it("returns to the screen it left after a short trip out", async () => {
  await mount();
  mockNavigate.mockClear();

  await leaveFor(AWAY_BEFORE_RECORDER_MS - 1);

  expect(mockNavigate).not.toHaveBeenCalled();
});

it("waits for the navigator before opening the recorder", async () => {
  mockIsReady.mockReturnValueOnce(false).mockReturnValueOnce(false);

  await mount();

  expect(mockIsReady.mock.calls.length).toBeGreaterThan(2);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});
