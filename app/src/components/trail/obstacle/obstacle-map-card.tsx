// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import MapOverlayDismissButton from "@/components/map/map-overlay-dismiss-button";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Surface } from "react-native-paper";
import TrailObstacleItem from "./trail-obstacle-item";

// keep-comment: a long description scrolls inside the card instead of covering the back chip
const MAX_HEIGHT_SHARE = 0.4;

interface Props {
  obstacle: TrailObstacle;
  trailIdentifier: string;
  onDismiss: () => void;
  // keep-comment: the covered height, so the map can lift its attribution clear of the card
  onMeasure?: (coveredHeight: number) => void;
}

export default function ObstacleMapCard({ obstacle, trailIdentifier, onDismiss, onMeasure }: Props) {
  const { height } = useWindowDimensions();

  return (
    <View
      testID="obstacle-map-card"
      style={s.wrapper}
      onLayout={(e) => onMeasure?.(e.nativeEvent.layout.height + SCREEN_PADDING)}
    >
      <MapOverlayDismissButton onPress={onDismiss} />
      <Surface style={s.card} elevation={2}>
        <ScrollView
          testID="obstacle-map-card-scroll"
          style={[s.scroll, { maxHeight: height * MAX_HEIGHT_SHARE }]}
          bounces={false}
        >
          <TrailObstacleItem obstacle={obstacle} trailIdentifier={trailIdentifier} outlined={false} />
        </ScrollView>
      </Surface>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: SCREEN_PADDING,
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,
  },
  card: {
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  scroll: {
    flexGrow: 0,
  },
});
