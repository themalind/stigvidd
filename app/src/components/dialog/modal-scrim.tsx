// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { StyleSheet, View } from "react-native";

// keep-comment: expo-blur's Android fallback colour for tint="dark" at intensity 100; iOS's real blur hid the app
export const SCRIM_COLOR = "rgba(25, 25, 25, 0.78)";

export default function ModalScrim() {
  return <View testID="modal-scrim" pointerEvents="none" style={[StyleSheet.absoluteFill, s.scrim]} />;
}

const s = StyleSheet.create({
  scrim: {
    backgroundColor: SCRIM_COLOR,
  },
});
