// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { pointFeatureFromPosition } from "@/utils/geo/geojson";
import { GeoJSONSource, Images, Layer } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";

// Module scope: <Images> re-registers on a new object, and this renders on every GPS fix. keep-comment: perf trap
const HEADING_IMAGE = "user-location-heading";
const HEADING_IMAGES = { [HEADING_IMAGE]: require("../../assets/images/user-heading.png") };

// Not themed: the basemap stays light in dark mode. keep-comment: deliberate, as in marker-styles.ts
const PUCK_FILL = "#1A73E8";
const PUCK_STROKE = "#FFFFFF";

interface Props {
  id: string;
  // [longitude, latitude] keep-comment: GeoJSON order, easy to swap
  position: GeoJSON.Position;
  // Degrees from north; null while standing still draws no arrow. keep-comment: unit and null meaning
  heading?: number | null;
  // keep-comment: keeps the puck above a layer that may load after the GPS fix
  // keep-comment: never change it on a mounted marker: native re-adds the same layer (use-after-free) and
  // keep-comment: throws on undefined after an id. Remount with a `key` instead.
  aboveLayerId?: string;
}

// Circle layers, never a view-hosted annotation, which is fragile on iOS/Fabric. keep-comment: platform bug
export default function UserLocationMarker({ id, position, heading, aboveLayerId }: Props) {
  const shape = useMemo(() => pointFeatureFromPosition(position), [position]);
  const hasHeading = typeof heading === "number";

  // keep-comment: halo, arrow, dot; the dot masks the arrow's base so only its tip shows
  // keep-comment: the arrow stays mounted and hides by opacity: unmounting it would move the dot's anchor (the use-after-free above)
  return (
    <>
      <Images images={HEADING_IMAGES} />
      <GeoJSONSource id={id} data={shape}>
        <Layer
          type="circle"
          id={`${id}-halo`}
          afterId={aboveLayerId}
          paint={{ "circle-color": PUCK_FILL, "circle-opacity": 0.18, "circle-radius": 20 }}
        />
        <Layer
          type="symbol"
          id={`${id}-heading`}
          afterId={aboveLayerId ? `${id}-halo` : undefined}
          layout={{
            "icon-image": HEADING_IMAGE,
            "icon-rotate": heading ?? 0,
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{ "icon-opacity": hasHeading ? 1 : 0 }}
        />
        <Layer
          type="circle"
          id={`${id}-dot`}
          afterId={aboveLayerId ? `${id}-heading` : undefined}
          paint={{
            "circle-color": PUCK_FILL,
            "circle-radius": 7,
            "circle-stroke-width": 3,
            "circle-stroke-color": PUCK_STROKE,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
