// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Pressable } from "react-native";
import { Icon, useTheme } from "react-native-paper";

interface Props {
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}

export default function InfoButton({ accessibilityLabel, onPress, testID }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      hitSlop={16}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Icon source="information" size={17} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}
