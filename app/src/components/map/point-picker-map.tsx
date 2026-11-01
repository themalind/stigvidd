// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Map from "@/components/map/map";
import StartMarker from "@/components/map/start-marker";
import { BORDER_RADIUS, SCREEN_PADDING, START_COORDINATE_BORAS } from "@/constants/constants";
import { Camera } from "@maplibre/maplibre-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const BORAS: GeoJSON.Position = [START_COORDINATE_BORAS.longitude, START_COORDINATE_BORAS.latitude];

type Props = {
  value: GeoJSON.Position | null;
  onChange: (position: GeoJSON.Position) => void;
  label: string;
  hint: string;
  testID?: string;
};

export default function PointPickerMap({ value, onChange, label, hint, testID }: Props) {
  const theme = useTheme();
  // The camera opens once; later taps move only the marker. keep-comment: re-centring on each tap would fight the user's panning
  const [initialCenter] = useState(() => value ?? BORAS);

  return (
    <View testID={testID} style={s.container}>
      <Map
        style={s.map}
        showsUserLocation={false}
        androidView="texture"
        attributionPosition={{ top: SCREEN_PADDING, left: SCREEN_PADDING }}
        onPress={(event) => onChange(event.nativeEvent.lngLat)}
      >
        <Camera
          initialViewState={{
            center: [initialCenter[0], initialCenter[1]],
            zoom: value ? 13 : 9.5,
          }}
        />
        {value ? <StartMarker id="picked-point" position={value} label={label} /> : null}
      </Map>
      <View pointerEvents="none" style={[s.hint, { backgroundColor: theme.colors.surface }]}>
        <Text style={[s.hintText, { color: theme.colors.onSurface }]}>{hint}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    height: 180,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  hint: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS,
  },
  hintText: {
    fontSize: 12,
  },
});
