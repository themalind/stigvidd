// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { IconButton, Menu } from "react-native-paper";

export type OverflowMenuItem = {
  icon: string;
  title: string;
  onPress: () => void;
  visible?: boolean;
};

type Props = {
  items: OverflowMenuItem[];
  testID: string;
  accessibilityLabel: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

// A "more" button whose menu closes before the chosen action runs; nothing shows when no item is visible. keep-comment: an action may open a dialog over the menu
export default function OverflowMenu({ items, testID, accessibilityLabel, size, style }: Props) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const shown = items.filter((item) => item.visible !== false);

  if (shown.length === 0) return null;

  const button = (
    <IconButton
      testID={testID}
      icon="dots-vertical"
      size={size}
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        setEverOpened(true);
        setOpen(true);
      }}
      style={style}
    />
  );

  // Paper's Menu animates out on mount and then closes for good if it was opened meanwhile, so it mounts on the first press. keep-comment: measured, a press in that window leaves the button dead
  if (!everOpened) return <View collapsable={false}>{button}</View>;

  return (
    <Menu visible={open} onDismiss={() => setOpen(false)} anchor={button}>
      {shown.map((item) => (
        <Menu.Item
          key={item.title}
          leadingIcon={item.icon}
          title={item.title}
          onPress={() => {
            setOpen(false);
            item.onPress();
          }}
        />
      ))}
    </Menu>
  );
}
