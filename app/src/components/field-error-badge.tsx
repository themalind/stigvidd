// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function FieldErrorBadge({ text, testID }: { text?: string; testID?: string }) {
  const theme = useTheme();
  if (!text) return null;
  return (
    <Text
      testID={testID}
      style={[s.errorBadge, { color: theme.colors.onErrorContainer, backgroundColor: theme.colors.errorContainer }]}
    >
      {text}
    </Text>
  );
}

const s = StyleSheet.create({
  errorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
});
