// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import IncomingSharedHikeModal from "@/components/shared-hike/incoming-shared-hike-modal";
import { SharedHike } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const onDismiss = jest.fn();
const onAccept = jest.fn();
const onReject = jest.fn();

function sharedHike(overrides: Partial<SharedHike> = {}): SharedHike {
  return {
    hikeIdentifier: "hike-1",
    hikeName: "Kvällspromenad",
    hikeLength: 4.2,
    duration: 5_400_000,
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]),
    createdByName: "bertil",
    sharedByName: "bertil",
    sharedByIdentifier: "friend-1",
    sharedAt: "2026-05-04T18:00:00Z",
    allowResharing: true,
    images: [],
    ...overrides,
  };
}

function show(props: Partial<React.ComponentProps<typeof IncomingSharedHikeModal>> = {}) {
  return renderWithProviders(
    <IncomingSharedHikeModal
      visible
      sharedHike={sharedHike()}
      onDismiss={onDismiss}
      onAccept={onAccept}
      onReject={onReject}
      {...props}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows who shared the walk, when, and its figures", () => {
  show();

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.getByText("bertil")).toBeTruthy();
  expect(screen.getByText("2026-05-04")).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("01:30:00")).toBeTruthy();
});

it("names a sharer who deleted their account as a deleted user", () => {
  show({ sharedHike: sharedHike({ sharedByName: null, sharedByIdentifier: null }) });

  expect(screen.getByText("Borttagen användare")).toBeTruthy();
});

it("shows the info rows the walk carries", () => {
  show({ sharedHike: sharedHike({ gettingThere: "Buss 100 till vändplan" }) });

  expect(screen.getByText("Hitta hit")).toBeTruthy();
  expect(screen.getByText("Buss 100 till vändplan")).toBeTruthy();
  expect(screen.queryByText("Parkering")).toBeNull();
});

it("waits with the spinner until the walk arrives, and says so when it cannot", () => {
  const { rerender } = show({ sharedHike: null, isLoading: true });
  expect(screen.queryByText("Kunde inte hämta promenaden, försök igen.")).toBeNull();

  rerender(
    <IncomingSharedHikeModal
      visible
      sharedHike={null}
      onDismiss={onDismiss}
      onAccept={onAccept}
      onReject={onReject}
      isError
    />,
  );
  expect(screen.getByText("Kunde inte hämta promenaden, försök igen.")).toBeTruthy();
});

it("offers a decision, and nothing else", () => {
  show();

  expect(screen.getByText("Acceptera")).toBeTruthy();
  expect(screen.getByText("Avvisa")).toBeTruthy();
  expect(screen.queryByText("Dela")).toBeNull();
  expect(screen.queryByText("Ta bort")).toBeNull();
});

it("passes the decision on", () => {
  show();

  fireEvent.press(screen.getByText("Acceptera"));
  fireEvent.press(screen.getByText("Avvisa"));

  expect(onAccept).toHaveBeenCalledTimes(1);
  expect(onReject).toHaveBeenCalledTimes(1);
});

it("takes no second decision while the first is in flight", () => {
  show({ isPending: true });

  fireEvent.press(screen.getByText("Acceptera"));
  fireEvent.press(screen.getByText("Avvisa"));

  expect(onAccept).not.toHaveBeenCalled();
  expect(onReject).not.toHaveBeenCalled();
});

it("draws the route without offering the follow screen before it is accepted", () => {
  show();

  expect(screen.queryByLabelText("Visa kartvy")).toBeNull();
  const layerIds = screen.queryAllByTestId("maplibre-Layer").map((node) => node.props.id);
  expect(layerIds.some((id: string) => id?.startsWith("incoming-hike-share"))).toBe(true);
});
