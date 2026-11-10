// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { Image } from "expo-image";
import { StyleSheet } from "react-native";

export const THUMBNAIL_SIZE = 52;

export default function ImageThumbnail({ uri, testID }: { uri: string; testID?: string }) {
  return <Image testID={testID} source={{ uri }} style={s.thumbnail} contentFit="cover" />;
}

const s = StyleSheet.create({
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: BORDER_RADIUS,
  },
});
