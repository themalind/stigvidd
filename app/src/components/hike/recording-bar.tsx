// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useHikeInProgress } from "@/hooks/hike/useHikeInProgress";
import { RECORDER_PATH, RECORDER_ROUTE } from "@/hooks/hike/useOpenActiveRecording";
import { MaterialIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  signedIn: boolean;
};

export default function RecordingBar({ signedIn }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const inProgress = useHikeInProgress(signedIn);

  if (!inProgress || pathname === RECORDER_PATH) return null;

  const color = theme.colors.onPrimary;
  const recording = inProgress.status === "recording";

  return (
    <Pressable
      testID="recording-bar"
      accessibilityRole="button"
      accessibilityLabel={t("createHike.barOpenLabel")}
      onPress={() => router.navigate(RECORDER_ROUTE, { withAnchor: true })}
      style={[s.bar, { backgroundColor: theme.colors.primary }]}
    >
      <MaterialIcons name={recording ? "fiber-manual-record" : "pause"} size={14} color={color} />
      <Text style={[s.status, { color }]}>{t(recording ? "createHike.barRecording" : "createHike.barPaused")}</Text>
      <View style={s.distance}>
        <Text style={{ color }}>{`${(inProgress.distance / 1000).toFixed(2)} km`}</Text>
      </View>
      <Text style={[s.status, { color }]}>{t("createHike.barOpen")}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  status: {
    fontWeight: "700",
  },
  distance: {
    flex: 1,
  },
});
