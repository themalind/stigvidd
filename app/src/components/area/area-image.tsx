// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ExampleImageOverlay from "@/components/media/example-image-overlay";
import { CityArea } from "@/data/types";
import { Image, ImageStyle } from "expo-image";
import { StyleProp, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  area: Pick<CityArea, "imageUrl" | "identifier">;
  style: StyleProp<ImageStyle & ViewStyle>;
}

// keep-comment: the area's cover image, or a plain surface when it has none
export default function AreaImage({ area, style }: Props) {
  const theme = useTheme();

  if (!area.imageUrl) {
    return <View style={[style, { backgroundColor: theme.colors.surfaceVariant }]} />;
  }

  return (
    <>
      <Image source={{ uri: area.imageUrl }} style={style} contentFit="cover" recyclingKey={area.identifier} />
      <ExampleImageOverlay source={{ uri: area.imageUrl }} />
    </>
  );
}
