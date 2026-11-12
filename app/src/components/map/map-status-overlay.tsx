// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

interface Props {
  isLoading?: boolean;
  errorMessage?: string;
}

export default function MapStatusOverlay({ isLoading, errorMessage }: Props) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={s.centreOverlay} pointerEvents="none">
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!errorMessage) return null;

  return (
    <View style={s.centreOverlay} pointerEvents="none">
      <View style={[s.messagePill, { backgroundColor: theme.colors.surface }]}>
        <Text style={{ color: theme.colors.onSurface }}>{errorMessage}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  centreOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  messagePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
});
