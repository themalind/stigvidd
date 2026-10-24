// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SymbolInfoModal from "@/components/trail/symbol-info-modal";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { Dimensions, StyleSheet } from "react-native";

const { width: WIDTH, height: HEIGHT } = Dimensions.get("screen");
const TITLE = "Ledmarkering";
const SYMBOL_URL = "https://media.stigvidd.se/symbols/bla-trekant.png";

const onDismiss = jest.fn();

function show({
  imageUrl = SYMBOL_URL,
  symbol = "Blå trekant",
  visible = true,
  theme = AppDefaultTheme as typeof AppDefaultTheme | typeof AppDarkTheme,
} = {}) {
  return renderWithProviders(
    <SymbolInfoModal imageUrl={imageUrl} symbol={symbol} visible={visible} onDismiss={onDismiss} />,
    { theme },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the symbol the trail is marked with, whole", () => {
  show();

  const image = screen.UNSAFE_getByType(Image);
  expect(image.props.source).toBe(SYMBOL_URL);
  expect(image.props.contentFit).toBe("contain");
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({ height: HEIGHT * 0.3, width: WIDTH * 0.55 });
});

it("names the symbol and explains what it is for", () => {
  show();

  expect(screen.getByText(TITLE)).toBeTruthy();
  expect(screen.getByText("Blå trekant")).toBeTruthy();
  expect(screen.getByText(/^Leden är märkt i terrängen med den här symbolen/)).toBeTruthy();
});

// A trail can carry a symbol image without a name for it.
it("leaves out the caption when the trail has no symbol text", () => {
  show({ symbol: "" });

  expect(screen.queryByTestId("symbol-info-caption")).toBeNull();
  expect(screen.getByTestId("symbol-info-image-frame")).toBeTruthy();
});

it("stays out of sight until it is opened", () => {
  show({ visible: false });

  expect(screen.queryByText(TITLE)).toBeNull();
});

it("closes from the cross", async () => {
  show();

  fireEvent.press(screen.getByTestId("symbol-info-close"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
});

// The seeded symbols are stand-ins and have to say so.
it("badges a mock symbol as an example image", () => {
  show({ imageUrl: "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" });

  expect(screen.getByTestId("example-image-overlay")).toBeTruthy();
});

it("leaves a real symbol unbadged", () => {
  show();

  expect(screen.queryByTestId("example-image-overlay")).toBeNull();
});

it("marks the dialog itself with a signpost", () => {
  show();

  expect(screen.getByTestId("icon-sign-direction", { includeHiddenElements: true })).toBeTruthy();
});

// The symbol is a flat graphic, often on white, so it needs a panel of its own.
it("sets the symbol on a panel of its own, in both themes", () => {
  const { unmount } = show();
  expect(screen.getByTestId("symbol-info-image-frame")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.secondaryContainer,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  });

  unmount();
  show({ theme: AppDarkTheme });
  expect(screen.getByTestId("symbol-info-image-frame")).toHaveStyle({
    backgroundColor: AppDarkTheme.colors.secondaryContainer,
  });
});
