// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import i18n from "@/i18n";
import { resizeImage } from "@/utils/resizeImage";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export async function pickImages({ limit }: { limit: number }): Promise<string[] | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(i18n.t("imagePermission.title"), i18n.t("imagePermission.message"));
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    ...(limit > 1 && { allowsMultipleSelection: true, selectionLimit: limit }),
  });

  if (result.canceled) {
    return null;
  }

  // keep-comment: iPhones pick HEIC and the API takes JPEG, see docs/notes/ios-image-picker-returns-heic-not-jpeg.md
  const uris: string[] = [];
  for (const asset of result.assets.slice(0, limit)) {
    uris.push(await resizeImage(asset.uri));
  }
  return uris;
}
