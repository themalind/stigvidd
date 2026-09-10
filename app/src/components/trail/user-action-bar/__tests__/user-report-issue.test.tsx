// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import UserReportIssue from "@/components/trail/user-action-bar/user-report-issue";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const TRAIL_ID = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

// The obstacle form is a modal with its own suite; this button only decides when it opens.
jest.mock("@/components/trail/obstacle/trail-obstacle-form", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({
      visible,
      trailIdentifier,
      onDismiss,
    }: {
      visible: boolean;
      trailIdentifier: string;
      onDismiss: () => void;
    }) =>
      visible
        ? ReactActual.createElement(Text, { testID: "obstacle-form", onPress: onDismiss }, trailIdentifier)
        : null,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
});

describe("UserReportIssue", () => {
  it("offers to report an issue", () => {
    renderWithProviders(<UserReportIssue trailIdentifier={TRAIL_ID} />);

    expect(screen.getByText("Rapportera")).toBeTruthy();
    expect(screen.getByTestId("icon-warning-amber")).toBeTruthy();
  });

  it("keeps the form closed until pressed", () => {
    renderWithProviders(<UserReportIssue trailIdentifier={TRAIL_ID} />);
    expect(screen.queryByTestId("obstacle-form")).toBeNull();
  });

  it("opens the form for the trail it belongs to", async () => {
    renderWithProviders(<UserReportIssue trailIdentifier={TRAIL_ID} />);
    fireEvent.press(screen.getByText("Rapportera"));
    await settle();

    expect(screen.getByTestId("obstacle-form")).toHaveTextContent(TRAIL_ID);
  });

  it("asks a signed-out user to sign in instead of opening the form", async () => {
    mockIsAuthenticated = false;
    renderWithProviders(<UserReportIssue trailIdentifier={TRAIL_ID} />);
    fireEvent.press(screen.getByText("Rapportera"));
    await settle();

    expect(screen.getByText("Du behöver vara inloggad för att rapportera en händelse.")).toBeTruthy();
    expect(screen.queryByTestId("obstacle-form")).toBeNull();
  });

  it("closes the form when it reports itself done", async () => {
    renderWithProviders(<UserReportIssue trailIdentifier={TRAIL_ID} />);
    fireEvent.press(screen.getByText("Rapportera"));
    await settle();

    fireEvent.press(screen.getByTestId("obstacle-form"));
    await settle();

    expect(screen.queryByTestId("obstacle-form")).toBeNull();
  });

  it("can be opened again after closing", async () => {
    renderWithProviders(<UserReportIssue trailIdentifier={TRAIL_ID} />);
    fireEvent.press(screen.getByText("Rapportera"));
    await settle();
    fireEvent.press(screen.getByTestId("obstacle-form"));
    await settle();
    fireEvent.press(screen.getByText("Rapportera"));
    await settle();

    expect(screen.getByTestId("obstacle-form")).toBeTruthy();
  });
});
