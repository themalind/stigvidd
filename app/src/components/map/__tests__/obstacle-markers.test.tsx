// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ObstacleMarkers from "@/components/map/obstacle-markers";
import { TrailObstacle } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const onSelect = jest.fn();

function obstacle(identifier: string, issueType = "FallenTree", positioned = true): TrailObstacle {
  return {
    identifier,
    userIdentifier: null,
    description: "Gran över stigen",
    issueType,
    incidentLongitude: positioned ? 12.94 : undefined,
    incidentLatitude: positioned ? 57.72 : undefined,
    createdAt: "2026-11-14T10:00:00Z",
  };
}

function source() {
  const node = screen.queryAllByTestId("maplibre-GeoJSONSource").find((n) => n.props.id === "follow-obstacles");
  if (!node) throw new Error("expected the obstacle source");
  return node;
}

function layer(id: string) {
  return screen.queryAllByTestId("maplibre-Layer").find((node) => node.props.id === id);
}

function pressFeatures(...features: Record<string, unknown>[]) {
  const stopPropagation = jest.fn();
  fireEvent(source(), "press", {
    nativeEvent: { features: features.map((properties) => ({ type: "Feature", properties })) },
    stopPropagation,
  });
  return stopPropagation;
}

async function show(obstacles: TrailObstacle[], selectedIdentifier: string | null = null) {
  return renderWithProviders(
    <ObstacleMarkers
      id="follow-obstacles"
      obstacles={obstacles}
      selectedIdentifier={selectedIdentifier}
      onSelect={onSelect}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("puts one pin on the map per obstacle reported with a position", async () => {
  await show([obstacle("o1"), obstacle("o2", "Mud", false), obstacle("o3", "Mud")]);

  expect(source().props.data.features.map((f: { id: string }) => f.id)).toEqual(["o1", "o3"]);
});

// keep-comment: MapLibre silently draws nothing for an image name that was never registered
it("registers a pin image for every issue type the layer can name", async () => {
  await show([obstacle("o1")]);

  const registered = Object.keys(screen.getByTestId("maplibre-Images").props.images);
  const named = (layer("follow-obstacles-pins")?.props.layout["icon-image"] as unknown[]).filter(
    (part): part is string => typeof part === "string" && part.startsWith("obstacle-pin-"),
  );
  expect(new Set(named)).toEqual(new Set(registered));
  expect(registered).toHaveLength(8);
});

it("picks the pin by issue type and falls back to the general one", async () => {
  await show([obstacle("o1")]);

  const expression = layer("follow-obstacles-pins")?.props.layout["icon-image"] as unknown[];
  expect(expression.slice(0, 4)).toEqual(["match", ["get", "issueType"], "FallenTree", "obstacle-pin-FallenTree"]);
  expect(expression.at(-1)).toBe("obstacle-pin-Other");
});

it("stands each pin on its tip and keeps it visible where pins overlap", async () => {
  await show([obstacle("o1")]);

  expect(layer("follow-obstacles-pins")?.props.layout).toMatchObject({
    "icon-anchor": "bottom",
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  });
});

it("enlarges the selected pin and draws it on top", async () => {
  await show([obstacle("o1"), obstacle("o2")], "o2");

  const layout = layer("follow-obstacles-pins")?.props.layout;
  expect(layout["icon-size"]).toEqual(["case", ["==", ["get", "identifier"], "o2"], 1.25, 1]);
  expect(layout["symbol-sort-key"]).toEqual(["case", ["==", ["get", "identifier"], "o2"], 1, 0]);
});

it("selects the tapped obstacle and keeps the tap from reaching the map", async () => {
  await show([obstacle("o1")]);

  const stopPropagation = pressFeatures({ identifier: "o1", issueType: "FallenTree" });

  expect(onSelect).toHaveBeenCalledWith("o1");
  expect(stopPropagation).toHaveBeenCalled();
});

it("ignores a tap that carries no obstacle", async () => {
  await show([obstacle("o1")]);

  pressFeatures();

  expect(onSelect).not.toHaveBeenCalled();
});

it("steps past the open obstacle when the tap lands on stacked pins", async () => {
  await show([obstacle("o1"), obstacle("o2")], "o1");

  pressFeatures({ identifier: "o1" }, { identifier: "o2" });

  expect(onSelect).toHaveBeenCalledWith("o2");
});

it("keeps the open obstacle when its pin is tapped again on its own", async () => {
  await show([obstacle("o1")], "o1");

  pressFeatures({ identifier: "o1" }, { identifier: "o1" });

  expect(onSelect).toHaveBeenCalledWith("o1");
});

it("stacks its layers above the given layer, and names none without one", async () => {
  const { rerender } = await show([obstacle("o1")]);
  expect(layer("follow-obstacles-hit")?.props.afterId).toBeUndefined();
  expect(layer("follow-obstacles-pins")?.props.afterId).toBeUndefined();

  await rerender(
    <ObstacleMarkers
      key="anchored"
      id="follow-obstacles"
      obstacles={[obstacle("o1")]}
      selectedIdentifier={null}
      onSelect={onSelect}
      aboveLayerId="follow-route-line"
    />,
  );

  expect(layer("follow-obstacles-hit")?.props.afterId).toBe("follow-route-line");
  expect(layer("follow-obstacles-hit-selected")?.props.afterId).toBe("follow-obstacles-hit");
  expect(layer("follow-obstacles-pins")?.props.afterId).toBe("follow-obstacles-hit-selected");
});

// keep-comment: a hit circle sized for the normal pin would leave the enlarged pin's head untappable
it("gives the enlarged pin a hit circle that grows and rises with it", async () => {
  await show([obstacle("o1"), obstacle("o2")], "o2");

  const normal = layer("follow-obstacles-hit")?.props;
  const selected = layer("follow-obstacles-hit-selected")?.props;
  if (!normal || !selected) throw new Error("expected both hit layers");
  expect(normal.filter).toEqual(["!=", ["get", "identifier"], "o2"]);
  expect(selected.filter).toEqual(["==", ["get", "identifier"], "o2"]);
  expect(selected.paint["circle-radius"]).toBe(normal.paint["circle-radius"] * 1.25);
  expect(selected.paint["circle-translate"]).toEqual([0, normal.paint["circle-translate"][1] * 1.25]);
});

// keep-comment: anchored to the map, the offset turns with a rotated map while the pins stay upright
it("keeps the hit circles on the pin heads when the map is rotated", async () => {
  await show([obstacle("o1")], "o1");

  expect(layer("follow-obstacles-hit")?.props.paint["circle-translate-anchor"]).toBe("viewport");
  expect(layer("follow-obstacles-hit-selected")?.props.paint["circle-translate-anchor"]).toBe("viewport");
});
