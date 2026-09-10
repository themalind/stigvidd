// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ExampleImageOverlay from "@/components/example-image-overlay";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const MOCK_URL = "https://stigvidd.se/trails/mock/gesebol/20250824100243.jpg";
const REAL_URL = "https://stigvidd.se/trails/uploads/20260901120000.jpg";
const LABEL = "Exempelbild";
const SHORT_LABEL = "Exempel";

function show(source: unknown = MOCK_URL, variant?: "badge" | "watermark") {
  return renderWithProviders(<ExampleImageOverlay source={source} variant={variant} />);
}

// The overlay sizes itself after the image, and nothing measures under Jest; this event gives it a box.
function measure(width: number) {
  fireEvent(screen.getByTestId("example-image-overlay"), "layout", {
    nativeEvent: { layout: { width, height: 180 } },
  });
}

// The badge is a claim about the picture, so it goes as soon as an upload replaces the placeholder.
it("stays out of the way of a real photograph", () => {
  show(REAL_URL);

  expect(screen.queryByTestId("example-image-overlay")).toBeNull();
});

it("stays away from a bundled image and from no image at all", () => {
  show(42);
  expect(screen.queryByTestId("example-image-overlay")).toBeNull();

  screen.unmount();
  // A trail with no images hands over an undefined source, which show()'s default would stand in for.
  renderWithProviders(<ExampleImageOverlay source={undefined} />);
  expect(screen.queryByTestId("example-image-overlay")).toBeNull();
});

it("marks a mock image handed over as a { uri } object", () => {
  show({ uri: MOCK_URL });
  measure(300);

  expect(screen.getByText(LABEL)).toBeTruthy();
});

// The rule is a substring match on the path, and the path's case is not ours to assume.
it("marks a mock image whatever case its path is in", () => {
  show("https://stigvidd.se/trails/MOCK/a.jpg");
  measure(300);

  expect(screen.getByText(LABEL)).toBeTruthy();
});

// Nothing is drawn before the width is known, or a full-size pill flashes across a 60 px thumbnail.
it("draws nothing until it has been measured", () => {
  show();

  expect(screen.getByTestId("example-image-overlay")).toBeTruthy();
  // A width of zero is narrower than every threshold, so an unmeasured overlay would draw the ribbon.
  for (const form of ["example-image-badge", "example-image-ribbon", "example-image-watermark"]) {
    expect(screen.queryByTestId(form)).toBeNull();
  }
  expect(screen.queryByText(LABEL)).toBeNull();
  expect(screen.queryByText(SHORT_LABEL)).toBeNull();
});

it("puts a pill in the corner of a full-width picture", () => {
  show();
  measure(360);

  expect(screen.getByTestId("example-image-badge")).toHaveStyle({
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    borderRadius: 4,
  });
  expect(screen.getByText(LABEL)).toHaveStyle({ fontSize: 10, letterSpacing: 0.3 });
});

// A card-sized picture takes the tighter pill: the same badge with less around the text.
it("tightens the pill on a card-sized picture", () => {
  show();
  measure(180);

  expect(screen.getByTestId("example-image-badge")).toHaveStyle({
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    borderRadius: 3,
  });
  expect(screen.getByText(LABEL)).toHaveStyle({ fontSize: 9, letterSpacing: 0 });
});

it("keeps the roomy pill at exactly the width the tighter one starts below", () => {
  show();
  measure(220);

  expect(screen.getByTestId("example-image-badge")).toHaveStyle({ top: 6, paddingHorizontal: 6 });
});

// Below this width a corner pill would cover most of the picture, so the label becomes a bottom ribbon.
it("lays a ribbon along the bottom of a thumbnail", () => {
  show();
  measure(72);

  expect(screen.queryByTestId("example-image-badge")).toBeNull();
  expect(screen.getByTestId("example-image-ribbon")).toHaveStyle({
    position: "absolute",
    left: 3,
    right: 3,
    bottom: 3,
    alignItems: "center",
  });
});

it("still shows a pill at exactly the width the ribbon starts below", () => {
  show();
  measure(120);

  expect(screen.getByTestId("example-image-badge")).toBeTruthy();
  expect(screen.queryByTestId("example-image-ribbon")).toBeNull();
});

// The ribbon abbreviates "Exempelbild", but a screen reader is told the whole word.
it("shortens the ribbon's label on screen but not for a screen reader", () => {
  show();
  measure(72);

  expect(screen.getByText(SHORT_LABEL)).toBeTruthy();
  expect(screen.queryByText(LABEL)).toBeNull();
  expect(screen.getByText(SHORT_LABEL).props.accessibilityLabel).toBe(LABEL);
  expect(screen.getByText(SHORT_LABEL).props.numberOfLines).toBe(1);
  expect(screen.getByText(SHORT_LABEL).props.adjustsFontSizeToFit).toBe(true);
});

// A layout width arrives as a float, and 119.6 is a picture wide enough for the pill.
it("rounds the measured width before it decides", () => {
  show();
  measure(119.6);

  expect(screen.getByTestId("example-image-badge")).toBeTruthy();
  expect(screen.queryByTestId("example-image-ribbon")).toBeNull();
});

// The overlay is re-laid out when its host changes size: a rotated phone, a thumbnail opened full screen.
it("changes form when the picture is measured again at another size", () => {
  show();
  measure(72);
  expect(screen.getByTestId("example-image-ribbon")).toBeTruthy();

  measure(360);

  expect(screen.getByTestId("example-image-badge")).toBeTruthy();
  expect(screen.queryByTestId("example-image-ribbon")).toBeNull();
});

it("writes the label diagonally across the picture as a watermark", () => {
  show(MOCK_URL, "watermark");
  measure(300);

  expect(screen.getByTestId("example-image-watermark")).toHaveStyle({
    alignItems: "center",
    justifyContent: "center",
  });
  expect(screen.getByText(LABEL)).toHaveStyle({ transform: [{ rotate: "-20deg" }] });
});

// The watermark is drawn wherever it is asked for, and the pill's width thresholds do not override that.
it("keeps the watermark a watermark on a thumbnail", () => {
  show(MOCK_URL, "watermark");
  measure(60);

  expect(screen.getByTestId("example-image-watermark")).toBeTruthy();
  expect(screen.queryByTestId("example-image-ribbon")).toBeNull();
  expect(screen.queryByTestId("example-image-badge")).toBeNull();
});

it("scales the watermark to the picture it lies on", () => {
  show(MOCK_URL, "watermark");
  measure(200);

  expect(screen.getByText(LABEL)).toHaveStyle({ fontSize: 22 });
});

// The clamp keeps a hero's letters from running off the edges and a thumbnail's from being unreadable.
it("holds the watermark between a readable and a containable size", () => {
  show(MOCK_URL, "watermark");
  measure(1000);
  expect(screen.getByText(LABEL)).toHaveStyle({ fontSize: 28 });

  screen.unmount();
  show(MOCK_URL, "watermark");
  measure(60);
  expect(screen.getByText(LABEL)).toHaveStyle({ fontSize: 10 });
});

// The overlay covers the whole picture, and the picture is usually a link.
it("covers the picture without taking its taps", () => {
  show();

  expect(screen.getByTestId("example-image-overlay")).toHaveStyle({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  expect(screen.getByTestId("example-image-overlay").props.pointerEvents).toBe("none");
});

// A large system font size would push the label out of its pill and across the picture.
it("holds every form of the label at its own size", () => {
  show();
  measure(360);
  expect(screen.getByText(LABEL).props.allowFontScaling).toBe(false);

  measure(72);
  expect(screen.getByText(SHORT_LABEL).props.allowFontScaling).toBe(false);

  screen.unmount();
  show(MOCK_URL, "watermark");
  measure(300);
  expect(screen.getByText(LABEL).props.allowFontScaling).toBe(false);
});
