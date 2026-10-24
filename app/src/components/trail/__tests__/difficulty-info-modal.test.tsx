// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DifficultyInfoModal from "@/components/trail/difficulty-info-modal";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

type Theme = typeof AppDefaultTheme | typeof AppDarkTheme;

const TITLE = "Svårighetsgrader";

const onDismiss = jest.fn();

function show(difficulty = 2, visible = true, theme: Theme = AppDefaultTheme) {
  return renderWithProviders(<DifficultyInfoModal difficulty={difficulty} visible={visible} onDismiss={onDismiss} />, {
    theme,
  });
}

function cards() {
  return screen.getAllByTestId("difficulty-info-card");
}

function highlighted(theme: Theme = AppDefaultTheme) {
  return cards().filter((card) => StyleSheet.flatten(card.props.style).borderColor === theme.colors.primary);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("what the modal explains", () => {
  // Every level the import can assign, including the one it assigns when it cannot classify.
  it("describes all four levels", () => {
    show();

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(cards()).toHaveLength(4);
    for (const label of ["Lätt", "Medel", "Svår", "Inte klassificerad"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("spells out what each level means on the ground", () => {
    show();

    expect(screen.getByText(/möjligt att ta sig fram med barnvagn/)).toBeTruthy();
    expect(screen.getByText(/mindre vägar och naturstigar/)).toBeTruthy();
    expect(screen.getByText(/stora nivåskillnader eller branta passager/)).toBeTruthy();
    expect(screen.getByText("Ingen officiell klassificering finns.")).toBeTruthy();
  });

  it("gives each level the marker used on the trail card", () => {
    show();

    expect(within(cards()[0]).getByTestId("icon-circle")).toBeTruthy();
    expect(within(cards()[1]).getByTestId("icon-diamond")).toBeTruthy();
    expect(within(cards()[2]).getByTestId("icon-triangle")).toBeTruthy();
  });

  it("stays out of sight until it is opened", () => {
    show(2, false);

    expect(screen.queryByText(TITLE)).toBeNull();
  });
});

describe("marking the trail's own level", () => {
  it.each([
    [1, "Lätt"],
    [2, "Medel"],
    [3, "Svår"],
    [0, "Inte klassificerad"],
  ])("picks out level %i", (difficulty, label) => {
    show(difficulty);

    const marked = highlighted();
    expect(marked).toHaveLength(1);
    expect(within(marked[0]).getByText(label)).toBeTruthy();
    expect(within(marked[0]).getByText("Den här leden")).toBeTruthy();
  });

  // A level the app does not know must leave every card plain rather than guess one.
  it("marks nothing when the level is not one of the four", () => {
    show(9);

    expect(highlighted()).toHaveLength(0);
    expect(screen.queryByText("Den här leden")).toBeNull();
  });

  it("marks nothing when there is no trail to compare with", () => {
    renderWithProviders(<DifficultyInfoModal visible onDismiss={onDismiss} />);

    expect(highlighted()).toHaveLength(0);
  });

  it("marks the level in the dark theme's own colours", () => {
    show(2, true, AppDarkTheme);

    expect(highlighted(AppDarkTheme)).toHaveLength(1);
    expect(highlighted(AppDarkTheme)[0]).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surfaceVariant });
  });
});

describe("closing it again", () => {
  it("closes from the cross", async () => {
    show();

    fireEvent.press(screen.getByTestId("difficulty-info-close"));
    await settle();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("closes from the Ok button", async () => {
    show();

    fireEvent.press(screen.getByTestId("difficulty-info-ok"));
    await settle();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
