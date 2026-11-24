// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ScreenHeader from "@/components/layout/screen-header";
import ErrorView from "@/components/status/error-view";
import { StyleSheet, View } from "react-native";
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
      <ScreenHeader />
      <ErrorView error={error} onRetry={onRetry} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
