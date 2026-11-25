// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { TrailObstacle } from "@/data/types";
import { featureCollectionFromObstacles } from "@/utils/geo/geojson";
import {
  type FilterSpecification,
  GeoJSONSource,
  Images,
  Layer,
  type PressEventWithFeatures,
  type SymbolLayerSpecification,
} from "@maplibre/maplibre-react-native";
import { useCallback, useMemo } from "react";
import { NativeSyntheticEvent } from "react-native";

type SymbolLayout = NonNullable<SymbolLayerSpecification["layout"]>;
type IconImageExpression = Extract<SymbolLayout["icon-image"], unknown[]>;
type IconSizeExpression = Extract<SymbolLayout["icon-size"], unknown[]>;
type SortKeyExpression = Extract<SymbolLayout["symbol-sort-key"], unknown[]>;

// Module scope: <Images> re-registers on a new object. keep-comment: perf trap, as in user-location-marker.tsx
// keep-comment: drawn by scripts/render-obstacle-pins.mjs, one per TrailIssueType
const PIN_IMAGES = {
  "obstacle-pin-FallenTree": require("../../assets/map/obstacle/obstacle-pin-FallenTree.png"),
  "obstacle-pin-Mud": require("../../assets/map/obstacle/obstacle-pin-Mud.png"),
  "obstacle-pin-Flooding": require("../../assets/map/obstacle/obstacle-pin-Flooding.png"),
  "obstacle-pin-Shelter": require("../../assets/map/obstacle/obstacle-pin-Shelter.png"),
  "obstacle-pin-FirePit": require("../../assets/map/obstacle/obstacle-pin-FirePit.png"),
  "obstacle-pin-Walkway": require("../../assets/map/obstacle/obstacle-pin-Walkway.png"),
  "obstacle-pin-Signage": require("../../assets/map/obstacle/obstacle-pin-Signage.png"),
  "obstacle-pin-Other": require("../../assets/map/obstacle/obstacle-pin-Other.png"),
};

// keep-comment: an unknown issue type gets the Other pin, as issue-type-parser.ts falls back to Other
const PIN_IMAGE: IconImageExpression = [
  "match",
  ["get", "issueType"],
  "FallenTree",
  "obstacle-pin-FallenTree",
  "Mud",
  "obstacle-pin-Mud",
  "Flooding",
  "obstacle-pin-Flooding",
  "Shelter",
  "obstacle-pin-Shelter",
  "FirePit",
  "obstacle-pin-FirePit",
  "Walkway",
  "obstacle-pin-Walkway",
  "Signage",
  "obstacle-pin-Signage",
  "obstacle-pin-Other",
];

const SELECTED_ICON_SIZE = 1.25;
const HIT_RADIUS = 22;
// keep-comment: the pin's tip marks the spot, so the hit circle is moved up onto its head (17.5 px down a 44 px image)
const HEAD_OFFSET = 26.5;

interface Props {
  id: string;
  obstacles: TrailObstacle[];
  selectedIdentifier: string | null;
  // keep-comment: every obstacle under the finger; stacked pins come back together
  onSelect: (identifiers: string[]) => void;
  // keep-comment: keeps the pins above a layer that may load after them; never change it on a mounted
  // keep-comment: component (see UserLocationMarker), remount with a `key` instead
  aboveLayerId?: string;
}

// Layers, never a view-hosted <Marker>, which is fragile on iOS/Fabric. keep-comment: platform bug
export default function ObstacleMarkers({ id, obstacles, selectedIdentifier, onSelect, aboveLayerId }: Props) {
  const shape = useMemo(() => featureCollectionFromObstacles(obstacles), [obstacles]);

  const { iconSize, sortKey, isSelected, isNotSelected } = useMemo(() => {
    const selected = selectedIdentifier ?? "";
    const iconSize: IconSizeExpression = ["case", ["==", ["get", "identifier"], selected], SELECTED_ICON_SIZE, 1];
    // keep-comment: the selected pin is drawn on top of any it overlaps
    const sortKey: SortKeyExpression = ["case", ["==", ["get", "identifier"], selected], 1, 0];
    const isSelected: FilterSpecification = ["==", ["get", "identifier"], selected];
    const isNotSelected: FilterSpecification = ["!=", ["get", "identifier"], selected];
    return { iconSize, sortKey, isSelected, isNotSelected };
  }, [selectedIdentifier]);

  const handlePress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      event.stopPropagation();
      // keep-comment: each pin appears once per layer it is hit in (circle and symbol), so duplicates are dropped
      const tapped = new Set(
        event.nativeEvent.features
          .map((feature) => feature.properties?.identifier)
          .filter((identifier): identifier is string => typeof identifier === "string"),
      );
      if (tapped.size > 0) onSelect([...tapped]);
    },
    [onSelect],
  );

  return (
    <>
      <Images images={PIN_IMAGES} />
      <GeoJSONSource id={id} data={shape} onPress={handlePress}>
        <Layer
          type="circle"
          id={`${id}-hit`}
          afterId={aboveLayerId}
          filter={isNotSelected}
          paint={{
            "circle-opacity": 0,
            "circle-radius": HIT_RADIUS,
            "circle-translate": [0, -HEAD_OFFSET],
            // keep-comment: the pins stay upright on screen, so their hit circles must not turn with a rotated map
            "circle-translate-anchor": "viewport",
          }}
        />
        {/* keep-comment: circle-translate cannot vary per feature, so the enlarged pin gets its own hit circle */}
        <Layer
          type="circle"
          id={`${id}-hit-selected`}
          afterId={aboveLayerId ? `${id}-hit` : undefined}
          filter={isSelected}
          paint={{
            "circle-opacity": 0,
            "circle-radius": HIT_RADIUS * SELECTED_ICON_SIZE,
            "circle-translate": [0, -HEAD_OFFSET * SELECTED_ICON_SIZE],
            "circle-translate-anchor": "viewport",
          }}
        />
        <Layer
          type="symbol"
          id={`${id}-pins`}
          afterId={aboveLayerId ? `${id}-hit-selected` : undefined}
          layout={{
            "icon-image": PIN_IMAGE,
            "icon-anchor": "bottom",
            "icon-size": iconSize,
            "symbol-sort-key": sortKey,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
