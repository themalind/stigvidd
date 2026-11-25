// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ImageBackdrop } from "@/components/layout/image-backdrop";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

it("stretches the image over the whole backdrop instead of the asset's own size", async () => {
  await render(
    <ImageBackdrop source={{ uri: "file://background.jpg", width: 400, height: 300 }}>
      <Text>content</Text>
    </ImageBackdrop>,
  );

  expect(screen.getByTestId("image-backdrop-image")).toHaveStyle({ width: "100%", height: "100%" });
  expect(screen.getByText("content")).toBeTruthy();
});
