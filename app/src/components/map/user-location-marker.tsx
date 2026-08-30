// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { pointFeatureFromPosition } from "@/utils/geojson";
import { GeoJSONSource, Images, Layer } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";

// Registered once under this name and referenced by the heading symbol layer. The map
// is held at module scope so its identity is stable: <Images> re-registers whenever the
// prop changes, and this component re-renders on every GPS fix (~every 3 m walked), so
// an inline object literal would re-register the icon into the style continuously.
const HEADING_IMAGE = "user-location-heading";
const HEADING_IMAGES = { [HEADING_IMAGE]: require("../../assets/images/user-heading.png") };

// Standard location blue, kept deliberately distinct from the green route line and
// trailhead marker so the walker can tell "me" from "the trail" at a glance. Fixed
// colours (never useTheme) because the basemap is always the light Outdoor style,
// even in the app's dark mode (same reasoning as marker-styles.ts).
const PUCK_FILL = "#1A73E8";
const PUCK_STROKE = "#FFFFFF";

interface Props {
  // Unique id prefix for this marker's source/layers within its map.
  id: string;
  // [longitude, latitude]
  position: GeoJSON.Position;
  // Course over ground in degrees clockwise from north. When null (user not
  // moving), no direction arrow is drawn — see useLiveUserLocation's speed gate.
  heading?: number | null;
  // Draw the puck directly above this layer id (e.g. the trail line) so it can
  // never be hidden underneath it. Needed because the trail geometry and the GPS
  // fix arrive at different times, and a layer added with no explicit order is
  // appended on top — so whichever mounts last would otherwise win. MapLibre waits
  // for the referenced layer to exist before inserting (verified in the native
  // insertAbove/addAbove paths), so this stays correct regardless of load order.
  //
  // Must not change for a given mount: the native side reacts to a new anchor by
  // removing the layer and re-adding the *same* object (MLRNLayer.setAboveLayerID),
  // which is a use-after-free path, and it dereferences the new anchor with `!!` so
  // passing undefined after a real id throws. Callers that can change the anchor must
  // remount this component with a `key` instead — see trail-follow-screen.
  aboveLayerId?: string;
}

// The live "you are here" puck, drawn as GeoJSON circle layers on the same layer
// pipeline as the route and trailhead — never a view-hosted annotation, which is
// the most fragile path on iOS under the New Architecture (see StartMarker). Its
// position is fed by useLiveUserLocation (expo-location) rather than MapLibre's
// built-in location engine, which froze the dot mid-walk on both platforms.
export default function UserLocationMarker({ id, position, heading, aboveLayerId }: Props) {
  const shape = useMemo(() => pointFeatureFromPosition(position), [position]);
  const hasHeading = typeof heading === "number";

  // Layer stack, bottom → top: halo, direction arrow, dot. The arrow sits under
  // the dot on purpose — the dot masks the arrow's base so only its tip shows,
  // pointing the way you're walking (the same trick MapLibre's own heading puck
  // uses). Each layer is pinned above the previous one so the order survives no
  // matter which source finishes loading first (see aboveLayerId).
  //
  // Every afterId below is derived only from `id` and `aboveLayerId`, both fixed for
  // the lifetime of a mount. That is deliberate: the arrow layer therefore stays
  // mounted even while stationary and is hidden with icon-opacity (a paint property,
  // applied in place) rather than being unmounted. Toggling its presence used to
  // shift the dot's anchor between the halo and the arrow, and each shift made the
  // native side remove the dot layer and re-add the same object — a use-after-free
  // that could also strand the dot permanently when the anchor vanished first,
  // making the puck disappear the moment you stopped walking.
  //
  // <Images> registers the icon into the style and is a sibling of the source (not
  // a layer child). It's registered unconditionally so the icon is always present
  // before the heading layer references it.
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
            // Falls back to 0 while hidden; the rotation and the opacity are applied
            // in the same update, so the arrow is never briefly visible pointing north.
            "icon-rotate": heading ?? 0,
            // Rotate with the map (so 0° = north) and keep a constant screen size.
            // The 40px icon is centred on the point; the dot (drawn on top) masks
            // its base so only the tip peeks out — hence icon-size is left at 1.
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{ "icon-opacity": hasHeading ? 1 : 0 }}
        />
        <Layer
          type="circle"
          id={`${id}-dot`}
          // Keep the solid dot above the halo and arrow; when no anchor is given,
          // natural append order already puts the dot last (on top).
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
