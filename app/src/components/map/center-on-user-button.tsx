// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { AppDefaultTheme } from "@/constants/theme";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Ionicons } from "@expo/vector-icons";
import { type CameraRef } from "@maplibre/maplibre-react-native";
import { RefObject } from "react";
import { Pressable, StyleSheet } from "react-native";

interface Props {
  cameraRef: RefObject<CameraRef | null>;
  // Optional extra action run when the button is pressed, in addition to centering
  // (e.g. re-enabling auto-follow on a screen that pauses following on user pan).
  onPress?: () => void;
  // When provided, fly to this live [longitude, latitude] instead of the button's
  // own one-shot fix. The follow screen already watches the user's position, so it
  // passes that through to keep the recenter target exactly on the puck.
  position?: GeoJSON.Position | null;
}

// Map controls sit on the always-light basemap, so they use the fixed light
// palette — never useTheme(), which would turn the button orange in dark mode.
const CONTROL_COLORS = AppDefaultTheme.colors;

export default function CenterOnUserButton({ cameraRef, onPress, position }: Props) {
  const { data: fetched } = useUserLocation();

  // Prefer a live position passed by the caller; otherwise fall back to this
  // button's own one-shot fix (ignoring the Borås fallback, which isn't the user).
  const center: GeoJSON.Position | null =
    position ?? (fetched && !fetched.isFallback ? [fetched.longitude, fetched.latitude] : null);

  const centerOnUser = () => {
    onPress?.();
    if (!center) return;
    cameraRef.current?.flyTo({ center: [center[0], center[1]], zoom: 14, duration: 800 });
  };

  if (!center) return null;

  return (
    <Pressable
      style={[s.center, { backgroundColor: CONTROL_COLORS.primary, borderColor: CONTROL_COLORS.onPrimary }]}
      onPress={centerOnUser}
    >
      <Ionicons name="locate" size={24} color={CONTROL_COLORS.onPrimary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: {
    position: "absolute",
    // No safe-area offset: every map that mounts this sits inside the tab navigator,
    // and the tab bar below already clears the home indicator.
    bottom: 18,
    right: 15,
    padding: 12,
    borderWidth: 2,
    borderRadius: 999,
  },
});
