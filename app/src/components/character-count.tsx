// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  value: string | undefined;
  max: number;
  testID?: string;
}

export default function CharacterCount({ value, max, testID }: Props) {
  const theme = useTheme();
  const length = value?.length ?? 0;
  return (
    <Text
      testID={testID}
      style={[s.count, { color: length >= max ? theme.colors.error : theme.colors.onSurfaceVariant }]}
    >
      {length}/{max}
    </Text>
  );
}

const s = StyleSheet.create({
  count: {
    alignSelf: "flex-end",
    fontSize: 12,
  },
});
