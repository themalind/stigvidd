// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Map as MapLibreMap, type MapProps, type MapRef, UserLocation } from "@maplibre/maplibre-react-native";
import { Image } from "expo-image";
import { useAtomValue } from "jotai";
import React, { forwardRef, useCallback, useEffect, useRef } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import { basemapAtom } from "@/atoms/basemap-atom";
import { SCREEN_PADDING } from "@/constants/constants";
import { getMapStyle } from "./map-style";

type Props = Partial<Omit<MapProps, "mapStyle" | "ref" | "style">> & {
  style?: StyleProp<ViewStyle>;
  showsUserLocation?: boolean;
  // keep-comment: false while the route or area is still loading, so the camera's jump to it happens behind the cover
  contentReady?: boolean;
  children?: React.ReactNode;
};

type OrnamentPosition = NonNullable<MapProps["attributionPosition"]>;

const LOGO_WIDTH = 67;
const LOGO_HEIGHT = 20;
const LOGO_GAP = 4;
const DEFAULT_ATTRIBUTION_POSITION: OrnamentPosition = { bottom: SCREEN_PADDING, left: SCREEN_PADDING };
export const MAP_FADE_MS = 150;
export const MAP_REVEAL_FALLBACK_MS = 3000;

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
  {
    style,
    showsUserLocation = true,
    attributionPosition = DEFAULT_ATTRIBUTION_POSITION,
    contentReady = true,
    onDidFinishRenderingMapFully,
    onDidFailLoadingMap,
    children,
    ...rest
  },
  ref,
) {
  const basemap = useAtomValue(basemapAtom);
  const theme = useTheme();
  const positions = ornamentPositions(attributionPosition);
  const cover = useRef(new Animated.Value(1)).current;
  const revealed = useRef(false);
  const contentReadyRef = useRef(contentReady);

  // keep-comment: a render that finished before the content arrived shows the default view, so only a later one reveals
  useEffect(() => {
    contentReadyRef.current = contentReady;
  }, [contentReady]);

  const reveal = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    Animated.timing(cover, { toValue: 0, duration: MAP_FADE_MS, useNativeDriver: true }).start();
  }, [cover]);

  // Shows the map anyway if it never reports a full render, e.g. offline with tiles missing. keep-comment: the cover must never trap the map
  useEffect(() => {
    const timer = setTimeout(reveal, MAP_REVEAL_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [reveal]);

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
        onDidFinishRenderingMapFully={(event) => {
          if (contentReadyRef.current) reveal();
          onDidFinishRenderingMapFully?.(event);
        }}
        onDidFailLoadingMap={(event) => {
          reveal();
          onDidFailLoadingMap?.(event);
        }}
        {...rest}
      >
        {showsUserLocation && <UserLocation />}
        {children}
      </MapLibreMap>
      {/* A cover that fades out, not the map: Android draws the map on a GL surface that ignores a parent's opacity. keep-comment: why not fade the map itself */}
      <Animated.View
        testID="map-loading-cover"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surfaceVariant, opacity: cover }]}
      />
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
