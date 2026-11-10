// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Badge, useTheme } from "react-native-paper";

// One size for count badges beside a label and on the tab bar, so the two read alike. keep-comment: shared with the tab bar badge
export const BADGE_SIZE = 22;
export const BADGE_FONT_SIZE = 13;
export const BADGE_FONT_FAMILY = "Inter_600SemiBold";

type Props = {
  count: number | undefined;
  accessibilityLabel?: string;
  testID?: string;
  size?: number;
  // "attention" is for something new; "neutral" just counts. keep-comment: when to pick which tone
  tone?: "attention" | "neutral";
  // Paper sizes the digits at half the badge, which reads too small at 22 px and below. keep-comment: why the override exists
  fontSize?: number;
  // Paper aligns a badge to the end of its row; true centres it beside text instead. keep-comment: Paper's default is alignSelf flex-end
  centered?: boolean;
};

export default function CountBadge({
  count,
  accessibilityLabel,
  testID,
  size = BADGE_SIZE,
  tone = "attention",
  fontSize,
  centered = false,
}: Props) {
  const theme = useTheme();

  if (count === undefined || count <= 0) return null;

  const colors =
    tone === "neutral"
      ? { backgroundColor: theme.colors.secondary, color: theme.colors.onSecondary }
      : { backgroundColor: theme.colors.tertiary, color: theme.colors.onTertiary };
  const digits = fontSize ?? (size === BADGE_SIZE ? BADGE_FONT_SIZE : undefined);
  const text = digits ? { fontSize: digits, fontFamily: BADGE_FONT_FAMILY } : undefined;

  return (
    <Badge
      testID={testID}
      size={size}
      accessibilityLabel={accessibilityLabel}
      style={[colors, text, centered ? { alignSelf: "center" } : undefined]}
    >
      {count}
    </Badge>
  );
}
