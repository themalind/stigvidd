// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  testID?: string;
  label: string;
  onPress: () => void;
}

export default function SeeAllLink({ testID, label, onPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={12} accessibilityRole="link">
      <Text style={[s.label, { color: theme.colors.tertiary }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
