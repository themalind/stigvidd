// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { act, renderHook } from "@testing-library/react-native";
import { Dimensions, Keyboard, KeyboardEvent, Platform } from "react-native";
import { useModalKeyboardLift } from "../useModalKeyboardLift";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

const KEYBOARD = 300;
const { height: WINDOW } = Dimensions.get("window");

type Handler = (e: KeyboardEvent) => void;
let handlers: Record<string, Handler>;
const originalOS = Platform.OS;

beforeEach(() => {
  handlers = {};
  jest.spyOn(Keyboard, "addListener").mockImplementation((event, handler) => {
    handlers[event] = handler as Handler;
    return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = originalOS;
});

function emit(event: string) {
  const handler = handlers[event];
  if (!handler) throw new Error(`expected a ${event} listener`);
  act(() => handler({ endCoordinates: { height: KEYBOARD } } as KeyboardEvent));
}

describe("useModalKeyboardLift", () => {
  it("rests at the height fraction with no lift while the keyboard is hidden", () => {
    const { result } = renderHook(() => useModalKeyboardLift(0.6));

    expect(result.current.modalStyle).toBeUndefined();
    expect(result.current.maxHeight).toBe(WINDOW * 0.6);
  });

  it("lifts above the keyboard on iOS and drops back when it hides", () => {
    Platform.OS = "ios";
    const { result } = renderHook(() => useModalKeyboardLift(0.6));

    emit("keyboardWillShow");
    expect(result.current.modalStyle).toEqual({ marginBottom: KEYBOARD + 10 });

    emit("keyboardWillHide");
    expect(result.current.modalStyle).toBeUndefined();
  });

  it("lifts on Android too, adding the navigation bar its keyboard height leaves out", () => {
    Platform.OS = "android";
    const { result } = renderHook(() => useModalKeyboardLift(0.6));

    emit("keyboardDidShow");
    expect(result.current.modalStyle).toEqual({ marginBottom: KEYBOARD + 34 + 10 });
    expect(result.current.maxHeight).toBe(Math.min(WINDOW * 0.6, WINDOW - (KEYBOARD + 34 + 10) - 47 - 10));

    emit("keyboardDidHide");
    expect(result.current.modalStyle).toBeUndefined();
  });
});
