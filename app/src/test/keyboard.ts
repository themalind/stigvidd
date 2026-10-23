// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { act } from "@testing-library/react-native";
import { EmitterSubscription, Keyboard, KeyboardEvent } from "react-native";

// keep-comment: call before rendering; keeps every listener, since KeyboardAwareScrollView subscribes to the same events
export function captureKeyboard() {
  const listeners: { event: string; listener: (e: KeyboardEvent) => void }[] = [];
  jest.spyOn(Keyboard, "addListener").mockImplementation((event, listener) => {
    listeners.push({ event, listener: listener as (e: KeyboardEvent) => void });
    return { remove: jest.fn() } as unknown as EmitterSubscription;
  });

  const emit = (event: string, height: number) =>
    act(() =>
      listeners
        .filter((l) => l.event === event)
        .forEach((l) => l.listener({ endCoordinates: { height } } as KeyboardEvent)),
    );

  return {
    show: (height: number) => emit("keyboardWillShow", height),
    hide: () => emit("keyboardWillHide", 0),
  };
}
