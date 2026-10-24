// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface SectionProps {
  heading: string;
  text?: string;
  example?: string;
  icon?: ReactNode;
  badge?: string;
  tone?: "default" | "danger";
  selected?: boolean;
  children?: ReactNode;
  testID?: string;
}

export default function DialogSection({
  heading,
  text,
  example,
  icon,
  badge,
  tone = "default",
  selected = false,
  children,
  testID,
}: SectionProps) {
  const theme = useTheme();
  const danger = tone === "danger";
  // keep-comment: the dark theme's level1 is darker than its surface, so the card would vanish
  const cardColor = theme.dark ? theme.colors.elevation.level3 : theme.colors.elevation.level1;
  const backgroundColor = danger ? theme.colors.errorContainer : selected ? theme.colors.surfaceVariant : cardColor;
  const headingColor = danger ? theme.colors.onErrorContainer : theme.colors.primary;
  const textColor = danger ? theme.colors.onErrorContainer : theme.colors.onSurface;

  return (
    <View
      testID={testID}
      style={[s.card, { backgroundColor, borderColor: selected ? theme.colors.primary : "transparent" }]}
    >
      <View style={s.headingRow}>
        {icon}
        <Text style={[s.heading, { color: headingColor }]}>{heading}</Text>
        {badge && (
          <Text style={[s.badge, { color: theme.colors.onPrimary, backgroundColor: theme.colors.primary }]}>
            {badge}
          </Text>
        )}
      </View>
      {text && <Text style={[s.text, { color: textColor }]}>{text}</Text>}
      {example && <Text style={[s.example, { color: theme.colors.onSurfaceVariant }]}>{example}</Text>}
      {children}
    </View>
  );
}

interface ListItemProps {
  icon: string;
  color: string;
  text: string;
}

export function DialogListItem({ icon, color, text }: ListItemProps) {
  const theme = useTheme();

  return (
    <View style={s.listItem}>
      <Icon source={icon} size={18} color={color} />
      <Text style={[s.text, s.listText, { color: theme.colors.onSurface }]}>{text}</Text>
    </View>
  );
}

export function DialogText({ children }: { children: string }) {
  const theme = useTheme();

  return <Text style={[s.body, { color: theme.colors.onSurfaceVariant }]}>{children}</Text>;
}

const s = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  heading: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  badge: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  text: {
    fontSize: 13,
    lineHeight: 20,
  },
  example: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: "italic",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  listText: {
    flex: 1,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
});
