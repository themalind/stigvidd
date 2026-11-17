// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { Children, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

interface FacilityListProps {
  children: ReactNode;
}

// One surface for every facility row, split by hairlines, so the section reads as facts rather than tappable cards. keep-comment: why one surface, not a card per row
export default function FacilityList({ children }: FacilityListProps) {
  const theme = useTheme();
  const rows = Children.toArray(children);
  if (rows.length === 0) return null;
  return (
    <View
      testID="facility-list"
      style={[s.list, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}
    >
      {rows.map((row, index) => (
        <View
          key={index}
          testID="facility-list-row"
          style={index > 0 && [s.divided, { borderTopColor: theme.colors.outlineVariant }]}
        >
          {row}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: {
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    overflow: "hidden",
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
