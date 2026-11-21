// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ObstacleMapCard from "@/components/trail/obstacle/obstacle-map-card";
import { TrailObstacle } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
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

function show() {
  return renderWithProviders(<ObstacleMapCard obstacle={OBSTACLE} trailIdentifier="trail-1" width={300} />);
}

it("shows the obstacle with the same item as the obstacle list, without a second outline", async () => {
  await show();

  expect(screen.getByTestId("obstacle-item").props.children).toBe("trail-1:o1:plain");
});

it("takes the width the carousel gives it", async () => {
  await show();

  // keep-comment: Paper's Surface puts layout styles such as width on its outer layer
  expect(screen.getByTestId("obstacle-map-card-o1-outer-layer")).toHaveStyle({ width: 300 });
});

// keep-comment: an uncapped long description would cover the back chip and most of the map
it("caps its height and scrolls a long description", async () => {
  await show();

  expect(screen.getByTestId("obstacle-map-card-scroll")).toHaveStyle({
    maxHeight: Dimensions.get("window").height * 0.4,
  });
});
