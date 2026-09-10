// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import UserBar from "@/components/trail/user-action-bar/user-bar";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { Trail } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

const TRAIL_ID = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";

// Each action has its own suite; the bar's own job is which ones it mounts, in what order,
// and what it hands them.
function mockStub(name: string, prop: "trailIdentifier" | "trail" | "none") {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  const Stub = (props: Record<string, unknown>) => {
    const detail = prop === "none" ? "" : prop === "trail" ? (props.trail as Trail).identifier : props.trailIdentifier;
    return ReactActual.createElement(Text, { testID: `action-${name}` }, `${name}:${detail}`);
  };
  Stub.displayName = name;
  return { __esModule: true, default: Stub };
}

jest.mock("@/components/trail/user-action-bar/add-to-user-wishlist", () => mockStub("wishlist", "trailIdentifier"));
jest.mock("@/components/trail/user-action-bar/user-share", () => mockStub("share", "none"));
jest.mock("@/components/trail/user-action-bar/user-rating", () => mockStub("rating", "trail"));
jest.mock("@/components/trail/user-action-bar/user-report-issue", () => mockStub("report", "trailIdentifier"));
jest.mock("@/components/trail/user-action-bar/add-user-favorite", () => mockStub("favorite", "trailIdentifier"));

function trail(): Trail {
  return { identifier: TRAIL_ID, name: "Kronängsleden", trailLength: 4.2 } as Trail;
}

describe("UserBar", () => {
  it("mounts every action", () => {
    renderWithProviders(<UserBar trail={trail()} />);

    for (const name of ["wishlist", "share", "rating", "report", "favorite"]) {
      expect(screen.getByTestId(`action-${name}`)).toBeTruthy();
    }
  });

  it("keeps the actions in a stable order", () => {
    renderWithProviders(<UserBar trail={trail()} />);

    const order = screen.getAllByTestId(/^action-/).map((node) => node.props.testID);
    expect(order).toEqual(["action-wishlist", "action-share", "action-rating", "action-report", "action-favorite"]);
  });

  it("passes the trail identifier to every action that needs one", () => {
    renderWithProviders(<UserBar trail={trail()} />);

    expect(screen.getByTestId("action-wishlist")).toHaveTextContent(`wishlist:${TRAIL_ID}`);
    expect(screen.getByTestId("action-report")).toHaveTextContent(`report:${TRAIL_ID}`);
    expect(screen.getByTestId("action-favorite")).toHaveTextContent(`favorite:${TRAIL_ID}`);
  });

  it("passes the whole trail to the rating, which needs its name and length", () => {
    renderWithProviders(<UserBar trail={trail()} />);
    expect(screen.getByTestId("action-rating")).toHaveTextContent(`rating:${TRAIL_ID}`);
  });

  it("spreads the actions across a rounded bar", () => {
    renderWithProviders(<UserBar trail={trail()} />);

    expect(screen.getByTestId("user-bar")).toHaveStyle({
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: BORDER_RADIUS,
    });
  });

  it("takes its background from the theme", () => {
    renderWithProviders(<UserBar trail={trail()} />, { theme: AppDarkTheme });
    expect(screen.getByTestId("user-bar")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.outlineVariant });

    renderWithProviders(<UserBar trail={trail()} />, { theme: AppDefaultTheme });
    expect(screen.getAllByTestId("user-bar").at(-1)!).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.outlineVariant,
    });
  });
});
