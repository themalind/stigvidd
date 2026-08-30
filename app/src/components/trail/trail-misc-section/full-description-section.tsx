// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  fullDescription: string;
}

export default function FullDescriptionSection({ fullDescription }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.propertyContainer, { backgroundColor: theme.colors.surface }]}>
      <Text style={s.propertyText}>{fullDescription}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  propertyContainer: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  propertyText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 25,
  },
});
