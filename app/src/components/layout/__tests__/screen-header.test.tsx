// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ScreenHeader from "@/components/layout/screen-header";
import { SCREEN_PADDING } from "@/constants/constants";
import { renderWithProviders } from "@/test/render";
import { screen, within } from "@testing-library/react-native";
import { Platform, Text } from "react-native";

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
});

describe("on iOS", () => {
  beforeEach(() => {
    Platform.OS = "ios";
  });

  it("puts the back button and the actions on a bar, and the large title below", async () => {
    await renderWithProviders(<ScreenHeader title="Mina favoriter" actions={<Text>sök</Text>} />);

    const bar = screen.getByTestId("screen-header-bar");
    expect(within(bar).getByTestId("back-button")).toBeTruthy();
    expect(within(bar).getByText("sök")).toBeTruthy();
    expect(within(bar).queryByText("Mina favoriter")).toBeNull();
    expect(screen.getByRole("header", { name: "Mina favoriter" })).toHaveStyle({ fontSize: 26 });
  });

  it("keeps the same edge on every screen", async () => {
    await renderWithProviders(<ScreenHeader title="Tema" />);

    expect(screen.getByTestId("screen-header")).toHaveStyle({ paddingHorizontal: SCREEN_PADDING });
  });

  it("shows only the bar when the screen has no title of its own", async () => {
    await renderWithProviders(<ScreenHeader />);

    expect(screen.getByTestId("back-button")).toBeTruthy();
    expect(screen.queryByRole("header")).toBeNull();
  });

  it("shows a subtitle under the title", async () => {
    await renderWithProviders(<ScreenHeader title="Kvarnstigen" subtitle="Borås" subtitleIcon="map-marker" />);

    expect(within(screen.getByTestId("screen-header-subtitle")).getByText("Borås")).toBeTruthy();
  });

  it("lets touches through where there is no button", async () => {
    await renderWithProviders(<ScreenHeader title="Tema" />);

    expect(screen.getByTestId("screen-header").props.pointerEvents).toBe("box-none");
    expect(screen.getByTestId("screen-header-bar").props.pointerEvents).toBe("box-none");
  });
});

describe("on Android", () => {
  beforeEach(() => {
    Platform.OS = "android";
  });

  it("shows the same title with no back button, since the phone has its own", async () => {
    await renderWithProviders(<ScreenHeader title="Tema" />);

    expect(screen.queryByTestId("back-button")).toBeNull();
    expect(screen.queryByTestId("screen-header-bar")).toBeNull();
    expect(screen.getByRole("header", { name: "Tema" })).toHaveStyle({ fontSize: 26 });
  });

  it("keeps the bar when there are actions to show", async () => {
    await renderWithProviders(<ScreenHeader actions={<Text>dela</Text>} />);

    expect(within(screen.getByTestId("screen-header-bar")).getByText("dela")).toBeTruthy();
  });

  it("keeps the empty bar on a screen with no title, so content starts where it does on iOS", async () => {
    await renderWithProviders(<ScreenHeader />);

    expect(screen.getByTestId("screen-header-bar")).toHaveStyle({ minHeight: 44 });
    expect(screen.queryByTestId("back-button")).toBeNull();
  });
});
