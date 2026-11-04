// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CoverFramer from "@/components/cover-framer";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const onFocusChange = jest.fn();
const onDragChange = jest.fn();

// A 300-wide frame at 2:1 is 150 high; a square image shown 300 wide reaches 150 past it. keep-comment: the numbers below
function show(image = { width: 1000, height: 1000 }, focusY = 0.5) {
  renderWithProviders(
    <CoverFramer
      testID="cover"
      uri="file://cover.jpg"
      aspect={2}
      focusY={focusY}
      onFocusChange={onFocusChange}
      onDragChange={onDragChange}
    />,
  );
  act(() => {
    fireEvent(screen.getByTestId("cover"), "layout", { nativeEvent: { layout: { width: 300, height: 150 } } });
    screen.getByTestId("cover-image").props.onLoad({ nativeEvent: { source: image } });
  });
}

function imageTop() {
  return StyleSheet.flatten(screen.getByTestId("cover-image").props.style).top;
}

function drag(fromY: number, toY: number) {
  const frame = screen.getByTestId("cover-frame");
  fireEvent(frame, "responderGrant", { nativeEvent: { pageY: fromY } });
  fireEvent(frame, "responderMove", { nativeEvent: { pageY: toY } });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("CoverFramer", () => {
  it("places the image at its focus and says it can be dragged", () => {
    show();

    expect(imageTop()).toBe(-75);
    expect(screen.getByText("Dra för att flytta")).toBeTruthy();
  });

  it("follows the finger and reports the new focus only when let go", () => {
    show();

    drag(100, 130);

    expect(imageTop()).toBeCloseTo(-45);
    expect(onDragChange).toHaveBeenLastCalledWith(true);
    expect(onFocusChange).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId("cover-frame"), "responderRelease");

    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onFocusChange.mock.calls[0][0]).toBeCloseTo(0.3);
    expect(onDragChange).toHaveBeenLastCalledWith(false);
  });

  it("shows the rest of the image faintly while dragging", () => {
    show();
    expect(screen.queryByTestId("cover-ghost")).toBeNull();

    drag(100, 110);

    expect(screen.getByTestId("cover-ghost")).toBeTruthy();
  });

  it("offers nothing to drag for an image as wide as the frame", () => {
    show({ width: 2000, height: 1000 });

    expect(screen.queryByText("Dra för att flytta")).toBeNull();
    expect(screen.getByTestId("cover-frame").props.onStartShouldSetResponder()).toBe(false);
  });

  it("lets a screen reader move the framing a step at a time", () => {
    show();

    fireEvent(screen.getByTestId("cover-frame"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });

    expect(onFocusChange.mock.calls[0][0]).toBeCloseTo(0.6);
  });
});
