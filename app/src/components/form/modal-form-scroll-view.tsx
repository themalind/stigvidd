// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ComponentProps } from "react";
import { Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type Props = ComponentProps<typeof KeyboardAwareScrollView>;

// keep-comment: for a modal using useModalKeyboardLift; on iOS the lift already clears the keyboard, and the auto-scroll would push the field out of view
export default function ModalFormScrollView(props: Props) {
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      enableAutomaticScroll={Platform.OS !== "ios"}
      {...props}
    />
  );
}
