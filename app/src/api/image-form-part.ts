// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { File } from "expo-file-system";
import uuid from "react-native-uuid";

// expo/fetch, the global fetch since SDK 58, rejects React Native's { uri, type, name } part. keep-comment: hidden platform constraint, every upload must use this
export function imageFormPart(uri: string): Blob {
  const part = {
    name: `${uuid.v4()}.jpg`,
    type: "image/jpeg",
    bytes: () => new File(uri).bytes(),
  };
  return part as unknown as Blob;
}
