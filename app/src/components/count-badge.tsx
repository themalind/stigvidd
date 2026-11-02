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
};

export default function CountBadge({ count, accessibilityLabel, testID }: Props) {
  const theme = useTheme();

  if (count === undefined || count <= 0) return null;

  return (
    <Badge
      testID={testID}
      size={24}
      accessibilityLabel={accessibilityLabel}
      style={{ backgroundColor: theme.colors.tertiary, color: theme.colors.onTertiary }}
    >
      {count}
    </Badge>
  );
}
