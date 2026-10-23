// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useIosKeyboardHeight } from "@/hooks/useIosKeyboardHeight";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const KEYBOARD_GAP = 10;

// keep-comment: modalStyle goes on Paper's Modal `style` (the centring wrapper); maxHeight is always set, since a card without one outgrows the screen and its ScrollView stops scrolling
export function useModalKeyboardLift(heightFraction: number) {
  const keyboardHeight = useIosKeyboardHeight();
  const { top } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const resting = height * heightFraction;

  if (keyboardHeight === 0) return { modalStyle: undefined, maxHeight: resting };

  const shift = keyboardHeight + KEYBOARD_GAP;
  return {
    modalStyle: { marginBottom: shift },
    maxHeight: Math.min(resting, height - shift - top - KEYBOARD_GAP),
  };
}
