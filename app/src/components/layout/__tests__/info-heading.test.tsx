// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import InfoHeading from "@/components/layout/info-heading";
import { flushUntilGone } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

it("opens its explanation from the info button and closes it again", async () => {
  await renderWithProviders(
    <InfoHeading label="Rubrik" infoTitle="Om rubriken" infoIntro="Det här betyder rubriken." infoText={["Mer."]} />,
  );
  expect(screen.queryByTestId("info-dialog")).toBeNull();

  await fireEvent.press(screen.getByLabelText("Om rubriken"));
  expect(screen.getByTestId("info-dialog")).toHaveTextContent(/Det här betyder rubriken\.\s*Mer\./);

  await fireEvent.press(screen.getByTestId("info-dialog-ok"));
  await flushUntilGone(() => screen.queryByTestId("info-dialog"));
  expect(screen.queryByTestId("info-dialog")).toBeNull();
});

it("narrows the info button's touch area when asked, so it can sit close to another button", async () => {
  const slop = { top: 16, left: 16, right: 16, bottom: 0 };
  await renderWithProviders(<InfoHeading label="Rubrik" infoTitle="Om rubriken" infoHitSlop={slop} />);

  expect(screen.getByLabelText("Om rubriken").props.hitSlop).toEqual(slop);
});

it("draws the label in the style it is given, to match the fields around it", async () => {
  await renderWithProviders(
    <InfoHeading label="Rubrik" labelStyle={{ fontSize: 11, textTransform: "uppercase" }} infoTitle="Om rubriken" />,
  );

  expect(screen.getByText("Rubrik")).toHaveStyle({ fontSize: 11, textTransform: "uppercase" });
});
