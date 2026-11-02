// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CountBadge from "@/components/count-badge";
import { BORDER_RADIUS } from "@/constants/constants";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

type Props = {
  count: number;
  open: boolean;
  onToggle: () => void;
};

export default function EventPinsToggle({ count, open, onToggle }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (count === 0) return null;

  return (
    <View style={s.wrapper}>
      <IconButton
        testID="event-board-pins-toggle"
        icon="pin"
        iconColor={theme.colors.primary}
        accessibilityLabel={open ? t("events.hidePinned") : t("events.showPinned", { count })}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={[s.button, open && { backgroundColor: theme.colors.primaryContainer }]}
      />
      <View style={s.badge} pointerEvents="none">
        <CountBadge count={count} size={16} tone="neutral" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
  },
});
