// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Map as MapLibreMap, type MapProps, type MapRef, UserLocation } from "@maplibre/maplibre-react-native";
import { Image } from "expo-image";
import { useAtomValue } from "jotai";
import React, { forwardRef } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { basemapAtom } from "@/atoms/basemap-atom";
import { SCREEN_PADDING } from "@/constants/constants";
import { getMapStyle } from "./map-style";

type Props = Partial<Omit<MapProps, "mapStyle" | "ref" | "style">> & {
  style?: StyleProp<ViewStyle>;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
};

type OrnamentPosition = NonNullable<MapProps["attributionPosition"]>;

const LOGO_WIDTH = 67;
const LOGO_HEIGHT = 20;
const LOGO_GAP = 4;
const DEFAULT_ATTRIBUTION_POSITION: OrnamentPosition = { bottom: SCREEN_PADDING, left: SCREEN_PADDING };

export function ornamentPositions(position: OrnamentPosition) {
  const offset = LOGO_WIDTH + LOGO_GAP;
  if ("left" in position) {
    return { logo: position, attribution: { ...position, left: position.left + offset } };
  }
  return { logo: position, attribution: { ...position, right: position.right + offset } };
}

// Shared MapLibre base map: applies the chosen MapTiler basemap and
// the user-location puck, and forwards a MapRef. Callers add their own <Camera>,
// <GeoJSONSource> and <Layer> children. The logo and compass ornaments are
// hidden so the app can lay out its own controls, but the attribution button is
// kept on: MapTiler + OpenStreetMap attribution is required by the data licence
// on every screen, so it defaults on here rather than being opt-in per screen.
// MapTiler's Free plan also requires its logo visible, not just the text. keep-comment: contractual, not inferable
// It sits bottom-left (the one corner no custom control uses — the recenter
// button is bottom-right, the filter menu top-right, the back button top-left).
// No safe-area offset: fullscreen maps live inside the tab navigator, whose tab
// bar already clears the home indicator. Callers can still override via props —
// the embedded previews move it to the top, where their pills aren't.
export default forwardRef<MapRef, Props>(function Map(
  { style, showsUserLocation = true, attributionPosition = DEFAULT_ATTRIBUTION_POSITION, children, ...rest },
  ref,
) {
  const basemap = useAtomValue(basemapAtom);
  const positions = ornamentPositions(attributionPosition);
  return (
    <View style={style}>
      <MapLibreMap
        ref={ref}
        style={StyleSheet.absoluteFill}
        mapStyle={getMapStyle(basemap)}
        logo={false}
        attribution
        attributionPosition={positions.attribution}
        compass={false}
        {...rest}
      >
        {showsUserLocation && <UserLocation />}
        {children}
      </MapLibreMap>
      <Image
        testID="maptiler-logo"
        source={require("../../assets/map/maptiler-logo.svg")}
        style={[s.logo, positions.logo]}
        contentFit="contain"
        accessibilityLabel="MapTiler"
        pointerEvents="none"
      />
    </View>
  );
});

const s = StyleSheet.create({
  logo: { position: "absolute", width: LOGO_WIDTH, height: LOGO_HEIGHT },
});
