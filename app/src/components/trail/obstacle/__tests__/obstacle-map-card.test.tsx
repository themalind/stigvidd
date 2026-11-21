// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ObstacleMapCard from "@/components/trail/obstacle/obstacle-map-card";
import { SCREEN_PADDING } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";

// keep-comment: the item has its own suite; here it only shows what it was given
jest.mock("@/components/trail/obstacle/trail-obstacle-item", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({
      obstacle,
      trailIdentifier,
      outlined,
    }: {
      obstacle: { identifier: string };
      trailIdentifier: string;
      outlined?: boolean;
    }) =>
      ReactActual.createElement(
        Text,
        { testID: "obstacle-item" },
        `${trailIdentifier}:${obstacle.identifier}:${outlined === false ? "plain" : "outlined"}`,
      ),
  };
});

const OBSTACLE: TrailObstacle = {
  identifier: "o1",
  userIdentifier: null,
  description: "Gran över stigen",
  issueType: "FallenTree",
  incidentLongitude: 12.94,
  incidentLatitude: 57.72,
  createdAt: "2026-11-14T10:00:00Z",
};

function show(props: Partial<Parameters<typeof ObstacleMapCard>[0]> = {}) {
  return renderWithProviders(
    <ObstacleMapCard obstacle={OBSTACLE} trailIdentifier="trail-1" onDismiss={jest.fn()} {...props} />,
  );
}

it("shows the obstacle with the same item as the obstacle list, without a second outline", async () => {
  await show();

  expect(screen.getByTestId("obstacle-item").props.children).toBe("trail-1:o1:plain");
});

it("closes from its handle", async () => {
  const onDismiss = jest.fn();
  await show({ onDismiss });

  await fireEvent.press(screen.getByLabelText("Stäng"));

  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it("reports the height it covers, counting the gap below it", async () => {
  const onMeasure = jest.fn();
  await show({ onMeasure });

  fireEvent(screen.getByTestId("obstacle-map-card"), "layout", { nativeEvent: { layout: { height: 200 } } });

  expect(onMeasure).toHaveBeenCalledWith(200 + SCREEN_PADDING);
});

// keep-comment: an uncapped long description would cover the back chip and most of the map
it("caps its height and scrolls a long description", async () => {
  await show();

  expect(screen.getByTestId("obstacle-map-card-scroll")).toHaveStyle({
    maxHeight: Dimensions.get("window").height * 0.4,
  });
});
