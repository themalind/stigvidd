// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

export const PANEL_PADDING = 12;
// keep-comment: lets an image or map run to the panel's edges, past its padding
export const PANEL_BLEED = { marginHorizontal: -PANEL_PADDING };

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// keep-comment: anything drawn on a panel that needs its own plate uses theme.colors.background, which differs from surface in every theme
export default function SectionPanel({ children, title, subtitle, headerAction, testID, style }: Props) {
  const theme = useTheme();

  return (
    <View testID={testID} style={[s.panel, { backgroundColor: theme.colors.surface }, style]}>
      {title && (
        <View style={s.header}>
          <View style={s.headerText}>
            <Text style={[s.title, { color: theme.colors.onSurface }]}>{title}</Text>
            {subtitle && <Text style={[s.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>}
          </View>
          {headerAction}
        </View>
      )}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    marginHorizontal: SCREEN_PADDING,
    padding: PANEL_PADDING,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  subtitle: {
    fontSize: 13,
  },
});
