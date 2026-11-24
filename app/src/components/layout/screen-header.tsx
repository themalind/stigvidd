// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BackButton from "@/components/layout/back-button";
import { SCREEN_PADDING } from "@/constants/constants";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

type Props = {
  title?: string;
  subtitle?: string;
  subtitleIcon?: string;
  // keep-comment: drawn before the title, e.g. the heart on the favourites list
  icon?: ReactNode;
  // keep-comment: at the end of the row, e.g. search, filter or a menu
  actions?: ReactNode;
  titleLines?: number;
  testID?: string;
};

// keep-comment: the one header for every pushed screen: back button, icon, title and actions on one row
export default function ScreenHeader({
  title,
  subtitle,
  subtitleIcon,
  icon,
  actions,
  titleLines,
  testID = "screen-header",
}: Props) {
  const theme = useTheme();

  return (
    <View testID={testID} style={s.header} pointerEvents="box-none">
      <View testID={`${testID}-bar`} style={s.bar} pointerEvents="box-none">
        <BackButton />
        {icon}
        <View style={s.titleBlock}>
          {!!title && (
            <Text
              accessibilityRole="header"
              numberOfLines={titleLines}
              style={[s.title, { color: theme.colors.onBackground }]}
            >
              {title}
            </Text>
          )}
          {!!title && !!subtitle && (
            <View testID={`${testID}-subtitle`} style={s.subtitleRow}>
              {!!subtitleIcon && <Icon source={subtitleIcon} size={12} color={theme.colors.onSurfaceVariant} />}
              <Text style={[s.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>
            </View>
          )}
        </View>
        {!!actions && <View style={s.actions}>{actions}</View>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 4,
    paddingBottom: 8,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  subtitle: {
    fontSize: 13,
  },
});
