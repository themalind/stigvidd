// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailObstacleForm from "@/components/trail/obstacle/trail-obstacle-form";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

const mockCreate = jest.fn();
const mockIssueTypes = jest.fn();
const mockCoordinates = jest.fn();
const mockGetPermissions = jest.fn();
const mockLastKnown = jest.fn();
const mockCurrentPosition = jest.fn();
const mockOpenSettings = jest.fn();

jest.mock("@/api/trail-obstacles", () => ({
  createTrailObstacle: (...args: unknown[]) => mockCreate(...args),
  getObstacleIssueTypes: () => mockIssueTypes(),
}));

jest.mock("@/api/trails", () => ({
  getCoordinatesByTrailIdentifier: (...args: unknown[]) => mockCoordinates(...args),
}));

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: () => mockGetPermissions(),
  getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnown(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
  Accuracy: { Balanced: 3 },
}));

jest.mock("expo-linking", () => ({
  openSettings: () => mockOpenSettings(),
}));

// ON_TRAIL is a few metres off the trail and OFF_TRAIL far away, either side of isNearTrail's 500 m.
const TRAIL = [
  { latitude: 57.72, longitude: 12.94 },
  { latitude: 57.73, longitude: 12.95 },
];
const ON_TRAIL = { latitude: 57.7201, longitude: 12.9401 };
const OFF_TRAIL = { latitude: 59.33, longitude: 18.06 };

const onDismiss = jest.fn();
const DESCRIPTION = "Ett nedfallet träd spärrar stigen helt";

function show() {
  return renderWithProviders(<TrailObstacleForm trailIdentifier="trail-1" visible onDismiss={onDismiss} />);
}

async function settle() {
  await act(async () => {});
}

// The location switch needs the trail geometry, which is a second query resolving after the first flush.
async function showLoaded() {
  const rendered = show();
  await waitFor(() => expect(mockCoordinates).toHaveBeenCalled());
  await settle();
  await settle();
  return rendered;
}

function position(coords: { latitude: number; longitude: number }) {
  return { coords: { ...coords, accuracy: 5 } };
}

// Every interaction is flushed before the next: a queried element carries the closure of its own
// render, so a switch pressed before the re-render commits still sees the geometry as unloaded.
async function fillDescription(text = DESCRIPTION) {
  fireEvent.changeText(screen.getByTestId("obstacle-description"), text);
  await settle();
}

async function toggleLocationOn() {
  fireEvent(screen.getByTestId("obstacle-location-switch"), "valueChange", true);
  await settle();
}

async function submit() {
  fireEvent.press(screen.getByTestId("obstacle-submit"));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue(undefined);
  mockIssueTypes.mockResolvedValue(["Other", "FallenTree"]);
  mockCoordinates.mockResolvedValue({ coordinates: JSON.stringify(TRAIL) });
  mockGetPermissions.mockResolvedValue({ granted: true });
  mockLastKnown.mockResolvedValue(position(ON_TRAIL));
  mockCurrentPosition.mockResolvedValue(position(ON_TRAIL));
});

it("reports the obstacle the form describes", async () => {
  await showLoaded();

  await fillDescription();
  await submit();

  expect(mockCreate).toHaveBeenCalledWith({
    trailIdentifier: "trail-1",
    description: DESCRIPTION,
    issueType: "Other",
    incidentLatitude: null,
    incidentLongitude: null,
  });
  await waitFor(() => expect(onDismiss).toHaveBeenCalled());
});

// A one-word report helps nobody, and the limit is the backend validator's.
it("refuses a description that is missing or too short", async () => {
  await showLoaded();

  await submit();
  expect(await screen.findByText("Ge en kort beskrivning")).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled();

  await fillDescription("Träd i vägen");
  await submit();
  expect(await screen.findByText("Beskrivning för kort minst 15 tecken")).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled();
});

it("attaches the position when the reporter is standing on the trail", async () => {
  await showLoaded();

  await fillDescription();
  await toggleLocationOn();

  expect(screen.getByText("📍 Plats kommer att bifogas")).toBeTruthy();

  await submit();
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({ incidentLatitude: ON_TRAIL.latitude, incidentLongitude: ON_TRAIL.longitude }),
  );
});

// A position taken somewhere else would put the marker on a stretch of trail nobody reported.
it("refuses a position that is not on this trail, and still sends the report", async () => {
  mockLastKnown.mockResolvedValue(position(OFF_TRAIL));
  await showLoaded();

  await fillDescription();
  await toggleLocationOn();

  expect(screen.getByText("Du verkar inte befinna dig på leden. Platsen kan inte bifogas.")).toBeTruthy();
  expect(screen.queryByText("📍 Plats kommer att bifogas")).toBeNull();

  await submit();
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ incidentLatitude: null, incidentLongitude: null }));
});

it("sends the reporter to the system settings when the permission is missing", async () => {
  mockGetPermissions.mockResolvedValue({ granted: false });
  await showLoaded();

  await toggleLocationOn();

  expect(screen.getByText("Platsbehörighet saknas. Aktivera i systeminställningarna.")).toBeTruthy();
  expect(mockOpenSettings).toHaveBeenCalled();
  expect(mockLastKnown).not.toHaveBeenCalled();
});

it("says so when the fix cannot be had at all", async () => {
  mockLastKnown.mockRejectedValue(new Error("no gps"));
  mockCurrentPosition.mockRejectedValue(new Error("no gps"));
  await showLoaded();

  await toggleLocationOn();

  expect(screen.getByText("Kunde inte hämta plats, försök igen.")).toBeTruthy();
});

it("drops the attached position when the switch goes back off", async () => {
  await showLoaded();

  await fillDescription();
  await toggleLocationOn();
  expect(screen.getByText("📍 Plats kommer att bifogas")).toBeTruthy();

  fireEvent(screen.getByTestId("obstacle-location-switch"), "valueChange", false);
  await settle();

  await submit();
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ incidentLatitude: null, incidentLongitude: null }));
});

// The component is mounted on every trail detail screen, so nothing is fetched until the sheet opens.
it("fetches nothing until it is opened", async () => {
  renderWithProviders(<TrailObstacleForm trailIdentifier="trail-1" visible={false} onDismiss={onDismiss} />);
  await settle();

  expect(mockIssueTypes).not.toHaveBeenCalled();
  expect(mockCoordinates).not.toHaveBeenCalled();
});
