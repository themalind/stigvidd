// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import GuideScreen from "@/components/guide/guide-screen";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("opens on the section that matters most, with the rest folded away", () => {
  renderWithProviders(<GuideScreen />);

  expect(screen.getByText("Naturguide")).toBeTruthy();
  // Allemansrätten is the one section that starts open, so its body is on screen.
  expect(screen.queryByText("Rätten att röra sig fritt i naturen")).toBeNull();
  expect(screen.getByText("Naturreservat")).toBeTruthy();
  expect(screen.getByText("Läs mer")).toBeTruthy();
});

// A folded section shows its one-line summary; an open one shows its body instead.
it("swaps a section's summary for its body", () => {
  renderWithProviders(<GuideScreen />);

  // Allemansrätten starts open: body, no summary.
  expect(screen.getByText(/Allemansrätten är en unik svensk lag/)).toBeTruthy();
  expect(screen.queryByText("Rätten att röra sig fritt i naturen")).toBeNull();

  fireEvent.press(screen.getByText("Allemansrätten"));

  expect(screen.queryByText(/Allemansrätten är en unik svensk lag/)).toBeNull();
  expect(screen.getByText("Rätten att röra sig fritt i naturen")).toBeTruthy();
});

it("folds and unfolds a section", () => {
  renderWithProviders(<GuideScreen />);

  // Closed: the summary is the only thing under the title.
  expect(screen.getByText("Läs mer")).toBeTruthy();
  expect(screen.queryByText("SMHI — väderprognos")).toBeNull();

  fireEvent.press(screen.getByText("Läs mer"));
  expect(screen.getByText("SMHI — väderprognos")).toBeTruthy();

  fireEvent.press(screen.getByText("Läs mer"));
  expect(screen.queryByText("SMHI — väderprognos")).toBeNull();
});

it("turns the chevron over with the section", () => {
  renderWithProviders(<GuideScreen />);

  // One section starts open, so one chevron already points up.
  expect(screen.getAllByTestId("icon-chevron-up")).toHaveLength(1);
  const folded = screen.getAllByTestId("icon-chevron-down").length;

  fireEvent.press(screen.getByText("Läs mer"));

  expect(screen.getAllByTestId("icon-chevron-up")).toHaveLength(2);
  expect(screen.getAllByTestId("icon-chevron-down")).toHaveLength(folded - 1);
});

// A summary that wrapped would push the chevron out of the header row.
it("holds each summary to one line", () => {
  renderWithProviders(<GuideScreen />);
  fireEvent.press(screen.getByText("Allemansrätten"));

  const summary = screen.getByText("Rätten att röra sig fritt i naturen");
  expect(summary.props.numberOfLines).toBe(1);
  expect(summary.props.ellipsizeMode).toBe("tail");
});

// The links come from the translation file as objects, so without returnObjects they render "[object Object]".
it("lists the reading links and opens the one that is pressed", () => {
  renderWithProviders(<GuideScreen />);

  fireEvent.press(screen.getByText("Läs mer"));
  expect(screen.getByText("Allemansrätten — Naturvårdsverket")).toBeTruthy();
  expect(screen.queryByText("[object Object]")).toBeNull();

  fireEvent.press(screen.getByText("SMHI — väderprognos"));

  expect(Linking.openURL).toHaveBeenCalledWith("https://www.smhi.se/");
});

it("names its sources at the foot of the page", () => {
  renderWithProviders(<GuideScreen />);

  expect(screen.getByText(/Källa: Naturvårdsverket/)).toBeTruthy();
});
