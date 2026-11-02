// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Badge, useTheme } from "react-native-paper";

type Props = {
  count: number | undefined;
  accessibilityLabel?: string;
  testID?: string;
  size?: number;
  // "attention" is for something new; "neutral" just counts. keep-comment: when to pick which tone
  tone?: "attention" | "neutral";
};

export default function CountBadge({ count, accessibilityLabel, testID, size = 24, tone = "attention" }: Props) {
  const theme = useTheme();

  if (count === undefined || count <= 0) return null;

  const colors =
    tone === "neutral"
      ? { backgroundColor: theme.colors.secondary, color: theme.colors.onSecondary }
      : { backgroundColor: theme.colors.tertiary, color: theme.colors.onTertiary };

  return (
    <Badge testID={testID} size={size} accessibilityLabel={accessibilityLabel} style={colors}>
      {count}
    </Badge>
  );
}
