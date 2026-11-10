// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";

// keep-comment: React Native's Text, not Paper's: Paper's sans-serif family renders these weights thinner on Android
export function InfoCard({ testID, title, children }: { testID?: string; title: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <Surface testID={testID} elevation={0} style={[s.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[s.title, { color: theme.colors.onSurface }]}>{title}</Text>
      {children}
    </Surface>
  );
}

export function InfoGrid({ children }: { children: ReactNode }) {
  return <View style={s.grid}>{children}</View>;
}

interface InfoItemProps {
  label: string;
  labelAccessory?: ReactNode;
  value?: string;
  children?: ReactNode;
  fullWidth?: boolean;
}

export function InfoItem({ label, labelAccessory, value, children, fullWidth }: InfoItemProps) {
  return (
    <View style={fullWidth ? s.itemFull : s.item}>
      <View style={s.labelRow}>
        <InfoLabel>{label}</InfoLabel>
        {labelAccessory}
      </View>
      {children ?? <InfoValue>{value}</InfoValue>}
    </View>
  );
}

export function InfoLabel({ children, color }: { children: string; color?: string }) {
  const theme = useTheme();

  return <Text style={[s.label, { color: color ?? theme.colors.onSurfaceVariant }]}>{children}</Text>;
}

export function InfoValue({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return <Text style={[s.value, { color: theme.colors.onSurface }]}>{children}</Text>;
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: SURFACE_BORDER_RADIUS,
    gap: 12,
  },
  title: {
    fontWeight: "700",
    fontSize: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  item: {
    flexBasis: "45%",
    flexGrow: 1,
    gap: 2,
  },
  itemFull: {
    flexBasis: "100%",
    gap: 2,
  },
  labelRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  label: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  value: {
    fontSize: 14,
  },
});
