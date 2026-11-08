// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import { SCREEN_PADDING } from "@/constants/constants";
import { Platform, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

type Props = {
  error: unknown;
  onRetry?: () => void;
};

// A pushed screen that failed to load, with the screen's way back still on it. keep-comment: iOS has no other visible way out
export default function ErrorScreen({ error, onRetry }: Props) {
  const theme = useTheme();

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View style={s.header}>
        <BackButton />
      </View>
      <ErrorView error={error} onRetry={onRetry} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
  },
});
