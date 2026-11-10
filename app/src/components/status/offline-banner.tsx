// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useIsOnline } from "@/hooks/useIsOnline";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { useTheme } from "react-native-paper";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  // Without a header above it, the banner itself has to clear the status bar. keep-comment: layout constraint
  clearStatusBar: boolean;
};

export default function OfflineBanner({ clearStatusBar }: Props) {
  const isOnline = useIsOnline();
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <Animated.View
      testID="offline-banner"
      entering={FadeInUp.duration(150)}
      exiting={FadeOutUp.duration(120)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        s.banner,
        { backgroundColor: theme.colors.inverseSurface, paddingTop: (clearStatusBar ? insets.top : 0) + 4 },
      ]}
    >
      <MaterialIcons name="cloud-off" size={14} color={theme.colors.inverseOnSurface} />
      <Text style={[s.text, { color: theme.colors.inverseOnSurface }]}>{t("common.offline")}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 4,
  },
  text: {
    fontSize: 13,
  },
});
