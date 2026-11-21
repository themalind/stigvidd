// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { type Insets, Pressable } from "react-native";
import { Icon, useTheme } from "react-native-paper";

interface Props {
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
  hitSlop?: Insets | number;
}

export default function InfoButton({ accessibilityLabel, onPress, testID, hitSlop = 16 }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      hitSlop={hitSlop}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Icon source="information" size={17} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}
