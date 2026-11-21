// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { memo } from "react";
import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { Surface } from "react-native-paper";
import TrailObstacleItem from "./trail-obstacle-item";

// keep-comment: a long description scrolls inside the card instead of covering the back chip
const MAX_HEIGHT_SHARE = 0.4;

interface Props {
  obstacle: TrailObstacle;
  trailIdentifier: string;
  width: number;
}

export default memo(function ObstacleMapCard({ obstacle, trailIdentifier, width }: Props) {
  const { height } = useWindowDimensions();

  return (
    <Surface testID={`obstacle-map-card-${obstacle.identifier}`} style={[s.card, { width }]} elevation={2}>
      <ScrollView
        testID="obstacle-map-card-scroll"
        style={[s.scroll, { maxHeight: height * MAX_HEIGHT_SHARE }]}
        bounces={false}
      >
        <TrailObstacleItem obstacle={obstacle} trailIdentifier={trailIdentifier} outlined={false} />
      </ScrollView>
    </Surface>
  );
});

const s = StyleSheet.create({
  card: {
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  scroll: {
    flexGrow: 0,
  },
});
