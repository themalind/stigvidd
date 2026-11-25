// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showWarningAtom } from "@/atoms/snackbar-atoms";
import { AppDefaultTheme } from "@/constants/theme";
import { lngLat } from "@/utils/geo/geojson";
import { USER_LOCATION_KEY, useUserLocation } from "@/hooks/location/useUserLocation";
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
  onPress?: () => void;
  // keep-comment: a live position, so the target is exactly the puck rather than this button's one-shot fix
  position?: GeoJSON.Position | null;
}

// keep-comment: the light palette, since the basemap stays light in dark mode
const CONTROL_COLORS = AppDefaultTheme.colors;

export default function CenterOnUserButton({ cameraRef, onPress, position }: Props) {
  const { data: fetched } = useUserLocation();
  const queryClient = useQueryClient();
  const showWarning = useSetAtom(showWarningAtom);
  const { t } = useTranslation();

  // keep-comment: the Borås fallback is not the user, so it is never a target
  const center: GeoJSON.Position | null =
    position ?? (fetched && !fetched.isFallback ? [fetched.longitude, fetched.latitude] : null);

  const recover = async () => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) {
      await queryClient.invalidateQueries({ queryKey: USER_LOCATION_KEY });
      return;
    }

    // Safe: a press, not AppState, so no permission-dialog loop. keep-comment: Android livelock
    if (current.canAskAgain) {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (requested.granted) await queryClient.invalidateQueries({ queryKey: USER_LOCATION_KEY });
      return;
    }

    showWarning(t("map.locationBlocked"));
    Linking.openSettings().catch(() => undefined);
  };

  const centerOnUser = () => {
    onPress?.();
    if (!center) {
      void recover();
      return;
    }
    cameraRef.current?.flyTo({ center: lngLat(center), zoom: 14, duration: 800 });
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
    // No safe-area offset: the tab bar already clears the home indicator. keep-comment: hidden layout dependency
    bottom: 18,
    right: 15,
    padding: 12,
    borderWidth: 2,
    borderRadius: 999,
  },
});
