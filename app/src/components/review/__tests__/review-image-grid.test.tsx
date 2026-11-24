// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ReviewImageGrid from "@/components/review/review-image-grid";
import { ReviewImage } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

jest.mock("@/components/review/image-viewer", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({
      visible,
      initialIndex,
      onDismiss,
    }: {
      visible: boolean;
      initialIndex: number;
      onDismiss: () => void;
    }) =>
      visible
        ? ReactActual.createElement(
            Pressable,
            { testID: "viewer", onPress: onDismiss },
            ReactActual.createElement(Text, null, `viewer at ${initialIndex}`),
          )
        : null,
  };
});

const IMAGES: ReviewImage[] = [
  { identifier: "a", imageUrl: "https://media.stigvidd.se/a.jpg" },
  { identifier: "b", imageUrl: "https://media.stigvidd.se/b.jpg" },
  { identifier: "c", imageUrl: "https://media.stigvidd.se/c.jpg" },
];

it("names each image and its place for a screen reader", async () => {
  await renderWithProviders(<ReviewImageGrid reviewImages={IMAGES} />);

  expect(screen.getByLabelText("Visa bild 1 av 3")).toBeTruthy();
  expect(screen.getByLabelText("Visa bild 3 av 3")).toBeTruthy();
});

it("opens the viewer at the image that was pressed, and closes it", async () => {
  await renderWithProviders(<ReviewImageGrid reviewImages={IMAGES} />);
  expect(screen.queryByTestId("viewer")).toBeNull();

  await fireEvent.press(screen.getByTestId("review-image-2"));
  expect(screen.getByText("viewer at 2")).toBeTruthy();

  await fireEvent.press(screen.getByTestId("viewer"));
  expect(screen.queryByTestId("viewer")).toBeNull();
});
