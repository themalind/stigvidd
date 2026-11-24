// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BackButton from "@/components/layout/back-button";
import { SCREEN_PADDING } from "@/constants/constants";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

type Props = {
  title?: string;
  subtitle?: string;
  subtitleIcon?: string;
  // keep-comment: drawn before the title, e.g. the heart on the favourites list
  icon?: ReactNode;
  // keep-comment: right of the back button, e.g. search, filter or a menu
  actions?: ReactNode;
  titleLines?: number;
  testID?: string;
};

// keep-comment: the one header for every pushed screen: back button and actions on a bar, a large title below
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
  // keep-comment: Android shows no back button; the empty bar stays only when there is no title, so content starts at the same height as on iOS
  const showBar = Platform.OS === "ios" || !!actions || !title;

  return (
    <View testID={testID} style={s.header} pointerEvents="box-none">
      {showBar && (
        <View testID={`${testID}-bar`} style={s.bar} pointerEvents="box-none">
          <BackButton />
          <View style={s.actions}>{actions}</View>
        </View>
      )}
      {!!title && (
        <View style={s.titleBlock}>
          <View style={s.titleRow}>
            {icon}
            <Text
              accessibilityRole="header"
              numberOfLines={titleLines}
              style={[s.title, { color: theme.colors.onBackground }]}
            >
              {title}
            </Text>
          </View>
          {!!subtitle && (
            <View testID={`${testID}-subtitle`} style={s.subtitleRow}>
              {!!subtitleIcon && <Icon source={subtitleIcon} size={14} color={theme.colors.onSurfaceVariant} />}
              <Text style={[s.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  titleBlock: {
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 26,
    lineHeight: 32,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subtitle: {
    fontSize: 14,
  },
});
