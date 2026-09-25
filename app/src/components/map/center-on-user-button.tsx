// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showWarningAtom } from "@/atoms/snackbar-atoms";
import { AppDefaultTheme } from "@/constants/theme";
import { USER_LOCATION_KEY, useUserLocation } from "@/hooks/useUserLocation";
import { Ionicons } from "@expo/vector-icons";
import { type CameraRef } from "@maplibre/maplibre-react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useSetAtom } from "jotai";
import { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet } from "react-native";

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
  const queryClient = useQueryClient();
  const showWarning = useSetAtom(showWarningAtom);
  const { t } = useTranslation();

  // Prefer a live position passed by the caller; otherwise fall back to this
  // button's own one-shot fix (ignoring the Borås fallback, which isn't the user).
  const center: GeoJSON.Position | null =
    position ?? (fetched && !fetched.isFallback ? [fetched.longitude, fetched.latitude] : null);

  // With no position to fly to, the press asks for the permission instead.
  const recover = async () => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) {
      // Permitted but no fix yet; a refetch is all this can usefully do.
      await queryClient.invalidateQueries({ queryKey: USER_LOCATION_KEY });
      return;
    }

    // Requesting is safe here because the press is user-initiated, not AppState-driven.
    if (current.canAskAgain) {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (requested.granted) await queryClient.invalidateQueries({ queryKey: USER_LOCATION_KEY });
      return;
    }

    // Refused for good; only the settings app can undo it, so say why before going there.
    showWarning(t("map.locationBlocked"));
    Linking.openSettings().catch(() => undefined);
  };

  const centerOnUser = () => {
    onPress?.();
    if (!center) {
      void recover();
      return;
    }
    cameraRef.current?.flyTo({ center: [center[0], center[1]], zoom: 14, duration: 800 });
  };

  const noPosition = center === null;

  return (
    <Pressable
      testID="center-on-user"
      accessibilityRole="button"
      accessibilityLabel={t("map.centerOnUser")}
      style={[
        s.center,
        {
          backgroundColor: noPosition ? CONTROL_COLORS.surface : CONTROL_COLORS.primary,
          borderColor: noPosition ? CONTROL_COLORS.outline : CONTROL_COLORS.onPrimary,
        },
      ]}
      onPress={centerOnUser}
    >
      <Ionicons
        name={noPosition ? "locate-outline" : "locate"}
        size={24}
        color={noPosition ? CONTROL_COLORS.outline : CONTROL_COLORS.onPrimary}
      />
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
