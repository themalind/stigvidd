// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ImageBackdrop } from "@/components/layout/image-backdrop";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

it("lets the insets size the image, overriding the asset's own size", async () => {
  await render(
    <ImageBackdrop source={{ uri: "file://background.jpg", width: 400, height: 300 }}>
      <Text>content</Text>
    </ImageBackdrop>,
  );

  const style = StyleSheet.flatten(screen.getByTestId("image-backdrop-image").props.style as object) as object;
  expect(style).toMatchObject({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 });
  // keep-comment: the keys must be present and unset; a missing key leaves the asset's size in place on a device
  expect(Object.entries(style)).toEqual(
    expect.arrayContaining([
      ["width", undefined],
      ["height", undefined],
    ]),
  );
  expect(screen.getByText("content")).toBeTruthy();
});
