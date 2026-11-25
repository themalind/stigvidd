// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ReactNode } from "react";
import { Image, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface Props {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

// keep-comment: replaces React Native's deprecated ImageBackground, as its deprecation notice prescribes
export function ImageBackdrop({ source, style, children }: Props) {
  return (
    <View style={style}>
      <Image testID="image-backdrop-image" source={source} resizeMode="cover" style={s.image} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  // keep-comment: Image sizes a bundled asset to its own pixels, which the insets alone do not override
  image: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
});
