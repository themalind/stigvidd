// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { StyleSheet, View } from "react-native";
import { Switch, Text, useTheme } from "react-native-paper";

type Props = {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID: string;
};

export default function SwitchRow({ label, hint, value, onValueChange, testID }: Props) {
  const theme = useTheme();

  return (
    <View style={s.row}>
      <View style={s.text}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={[s.hint, { color: theme.colors.onSurfaceVariant }]}>{hint}</Text> : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onValueChange} accessibilityLabel={label} />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
  },
});
