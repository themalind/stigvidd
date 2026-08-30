// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ShimmerBlock from "@/components/skeletons/shimmer-block";
import { BORDER_RADIUS } from "@/constants/constants";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;

export default function MapSkeleton({ text }: { text?: string }) {
  const theme = useTheme();
  return (
    <View style={s.container}>
      <ShimmerBlock
        style={{
          borderRadius: BORDER_RADIUS,
          width: WIDTH * 0.9,
          height: HEIGHT * 0.3,
        }}
      />
      {text && (
        <View style={s.overlay}>
          <Text style={[s.text, { color: theme.colors.onSurfaceVariant }]}>{text}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
