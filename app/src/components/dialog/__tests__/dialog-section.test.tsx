// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogSection, { DialogListItem, DialogText } from "@/components/dialog/dialog-section";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

function section(
  props: Partial<React.ComponentProps<typeof DialogSection>> = {},
  theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme,
) {
  return renderWithProviders(
    <DialogSection testID="section" heading="Namn" text="Ett kort namn." example="T.ex. Runt Ballasjön" {...props} />,
    { theme },
  );
}

it("sets the heading in small bold capitals in the accent colour", () => {
  section();

  expect(screen.getByText("Namn")).toHaveStyle({
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: AppDefaultTheme.colors.primary,
  });
});

it("keeps the text readable and the example quieter than it", () => {
  section();

  expect(screen.getByText("Ett kort namn.")).toHaveStyle({
    fontSize: 13,
    lineHeight: 20,
    color: AppDefaultTheme.colors.onSurface,
  });
  expect(screen.getByText("T.ex. Runt Ballasjön")).toHaveStyle({
    fontStyle: "italic",
    color: AppDefaultTheme.colors.onSurfaceVariant,
  });
});

it("leaves out what it is not given", () => {
  section({ text: undefined, example: undefined });

  expect(screen.getByText("Namn")).toBeTruthy();
  expect(screen.queryByText("Ett kort namn.")).toBeNull();
  expect(screen.queryByText("T.ex. Runt Ballasjön")).toBeNull();
});

it("is a card with the shared radius", () => {
  section();

  expect(screen.getByTestId("section")).toHaveStyle({
    borderRadius: BORDER_RADIUS,
    backgroundColor: AppDefaultTheme.colors.elevation.level1,
    borderColor: "transparent",
  });
});

it("stands out from the dark dialog surface", () => {
  section({}, AppDarkTheme);

  expect(screen.getByTestId("section")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.elevation.level3 });
});

it("outlines, fills and badges the selected card", () => {
  section({ selected: true, badge: "Den här leden" });

  expect(screen.getByTestId("section")).toHaveStyle({
    borderColor: AppDefaultTheme.colors.primary,
    backgroundColor: AppDefaultTheme.colors.surfaceVariant,
  });
  expect(screen.getByText("Den här leden")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.primary });
});

it("turns into a warning in the error container colours", () => {
  section({ tone: "danger" });

  expect(screen.getByTestId("section")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.errorContainer });
  expect(screen.getByText("Namn")).toHaveStyle({ color: AppDefaultTheme.colors.onErrorContainer });
  expect(screen.getByText("Ett kort namn.")).toHaveStyle({ color: AppDefaultTheme.colors.onErrorContainer });
});

it("lists items behind their own icon", () => {
  renderWithProviders(<DialogListItem icon="check" color="rgb(1, 2, 3)" text="Bilder tagna i dagsljus" />);

  const check = screen.getByTestId("icon-check", { includeHiddenElements: true });
  expect(check.props.color).toBe("rgb(1, 2, 3)");
  expect(screen.getByText("Bilder tagna i dagsljus")).toBeTruthy();
});

it("sets body text a size up from the cards, in the quieter colour", () => {
  renderWithProviders(<DialogText>Vill du ta bort promenaden?</DialogText>);

  expect(screen.getByText("Vill du ta bort promenaden?")).toHaveStyle({
    fontSize: 15,
    lineHeight: 22,
    color: AppDefaultTheme.colors.onSurfaceVariant,
  });
});
