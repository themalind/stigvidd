// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { Image, ImageSource } from "expo-image";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

type Props = {
  images: (ImageSource | number)[];
  title: string;
  subtitle?: string;
  onPress: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export default function ImageLinkCard({ images, title, subtitle, onPress, testID, style }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [s.card, { backgroundColor: theme.colors.surface }, pressed && s.pressed, style]}
    >
      <View style={s.strip}>
        {images.map((image, index) => (
          <Image key={index} source={image} style={s.image} contentFit="cover" />
        ))}
      </View>
      <View style={s.footer}>
        <View style={s.text}>
          <Text style={[s.title, { color: theme.colors.onSurface }]}>{title}</Text>
          {subtitle && (
            <Text style={[s.subtitle, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.85,
  },
  strip: {
    flexDirection: "row",
    height: 110,
    gap: 2,
  },
  image: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  subtitle: {
    fontSize: 12,
  },
});
