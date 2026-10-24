// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AccessibilityInfoModal from "@/components/trail/accessibility-info-modal";
import { AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { Text } from "react-native-paper";

const TITLE = "Tillgänglighet";
const ADAPTED = "Tillgänglighetsanpassad";
const NOT_ADAPTED = "Ej tillgänglighetsanpassad";

const onDismiss = jest.fn();

function show(visible = true) {
  return renderWithProviders(<AccessibilityInfoModal visible={visible} onDismiss={onDismiss} />);
}

function icon(name: string) {
  return screen.getByTestId(`icon-${name}`, { includeHiddenElements: true });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// The modal explains what the wheelchair symbol promises, so "not adapted" belongs in it too.
it("explains both what an adapted place is and what an unadapted one is", () => {
  show();

  expect(screen.getByText(TITLE)).toBeTruthy();
  expect(screen.getByText(ADAPTED)).toBeTruthy();
  expect(screen.getByText(NOT_ADAPTED)).toBeTruthy();
  expect(screen.getAllByTestId("accessibility-info-card")).toHaveLength(2);
});

it("stays out of sight until it is opened", () => {
  show(false);

  expect(screen.queryByText(TITLE)).toBeNull();
});

it("closes from the cross", async () => {
  show();

  fireEvent.press(screen.getByTestId("accessibility-info-close"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
});

// The descriptions are one string with blank lines, which unsplit read as a gap inside a paragraph.
it("sets each description as separate paragraphs rather than one block", () => {
  show();

  expect(screen.getByText(/^Platser som är anpassade är tillgängliga för alla/)).toBeTruthy();
  expect(screen.getByText(/^Vad som finns på plats varierar/)).toBeTruthy();
  expect(screen.getByText(/^En plats eller led som inte är tillgänglighetsanpassad/)).toBeTruthy();
  expect(screen.getByText(/^I appen hittar du information om varje enskilt besöksmål/)).toBeTruthy();
});

it("leaves no blank line, and no empty paragraph, inside a card", () => {
  show();

  for (const card of screen.getAllByTestId("accessibility-info-card")) {
    // A label and two paragraphs: unsplit it would be one Text, with the blank line an empty third.
    const lines = within(card).UNSAFE_getAllByType(Text);
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(String(line.props.children).trim()).not.toBe("");
      expect(String(line.props.children)).not.toContain("\n");
    }
  }
});

it("spaces the paragraphs apart without indenting the first one", () => {
  show();

  expect(screen.getByText(/^Platser som är anpassade/)).not.toHaveStyle({ marginTop: 8 });
  expect(screen.getByText(/^Vad som finns på plats varierar/)).toHaveStyle({ marginTop: 8 });
});

it("gives each kind of place the icon that stands for it", () => {
  show();

  expect(icon("wheelchair-accessibility").props.color).toBe(AppDefaultTheme.colors.primary);
  expect(icon("hiking")).toBeTruthy();
});

it("marks the dialog itself with the accessibility symbol", () => {
  show();

  expect(icon("human-handsup")).toBeTruthy();
});
