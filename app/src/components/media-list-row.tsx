// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface Props {
  thumbnail: ReactNode;
  title: string;
  meta: readonly string[];
  caption?: string;
  trailing?: string;
  onPress: () => void;
  testID?: string;
}

export default function MediaListRow({ thumbnail, title, meta, caption, trailing, onPress, testID }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      {thumbnail}
      <View style={s.text}>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={s.metaRow}>
          {meta.map((part) => (
            <Text key={part} variant="bodySmall">
              {part}
            </Text>
          ))}
        </View>
        {!!(caption || trailing) && (
          <View style={s.captionRow}>
            {!!caption && (
              <Text variant="bodySmall" style={[s.caption, { color: theme.colors.secondary }]} numberOfLines={1}>
                {caption}
              </Text>
            )}
            {!!trailing && (
              <Text variant="bodySmall" style={s.trailing}>
                {trailing}
              </Text>
            )}
          </View>
        )}
      </View>
      <Icon source="chevron-right" size={20} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  text: {
    flex: 1,
  },
  title: {
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 12,
    marginTop: 2,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // keep-comment: without flex a long caption pushes the date off the row
  caption: {
    flex: 1,
  },
  trailing: {
    opacity: 0.6,
  },
});
