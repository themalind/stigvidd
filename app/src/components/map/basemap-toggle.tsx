// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { basemapAtom, saveBasemap } from "@/atoms/basemap-atom";
import { AppDefaultTheme } from "@/constants/theme";
import { useIsOnline } from "@/hooks/useIsOnline";
import { Ionicons } from "@expo/vector-icons";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";

const CONTROL_COLORS = AppDefaultTheme.colors;

export default function BasemapToggle() {
  const [basemap, setBasemap] = useAtom(basemapAtom);
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const satellite = basemap === "satellite";

  const toggle = () => {
    const next = satellite ? "outdoor" : "satellite";
    setBasemap(next);
    void saveBasemap(next);
  };

  return (
    <Pressable
      testID="basemap-toggle"
      accessibilityRole="button"
      accessibilityLabel={t(satellite ? "map.showOutdoor" : "map.showSatellite")}
      accessibilityState={{ disabled: !isOnline }}
      disabled={!isOnline}
      style={[
        s.toggle,
        { backgroundColor: CONTROL_COLORS.surface, borderColor: CONTROL_COLORS.outline },
        !isOnline && s.offline,
      ]}
      onPress={toggle}
    >
      <Ionicons name={satellite ? "map-outline" : "earth-outline"} size={24} color={CONTROL_COLORS.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  // Stacked above CenterOnUserButton (bottom 18, 52 tall) with a 12 gap. keep-comment: couples to another file's layout
  toggle: {
    position: "absolute",
    bottom: 82,
    right: 15,
    padding: 12,
    borderWidth: 2,
    borderRadius: 999,
  },
  offline: {
    opacity: 0.4,
  },
});
