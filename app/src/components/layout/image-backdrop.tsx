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
      <Image source={source} resizeMode="cover" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}
