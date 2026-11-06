// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

jest.mock("@/services/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import EnvironmentBadge from "@/components/environment-badge";
import { AppDefaultTheme } from "@/constants/theme";
import { logger } from "@/services/logger";
import { renderWithProviders } from "@/test/render";
import type { AppEnvironment } from "@/utils/app-environment";
import { screen } from "@testing-library/react-native";

function show(environment: AppEnvironment) {
  return renderWithProviders(<EnvironmentBadge environment={environment} />, { theme: AppDefaultTheme });
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows nothing in production", () => {
  show("production");

  expect(screen.queryByTestId("environment-badge")).toBeNull();
});

it("shows nothing when the environment is unknown", () => {
  show("unknown");

  expect(screen.queryByTestId("environment-badge")).toBeNull();
});

it("marks a staging build", () => {
  show("staging");

  expect(screen.getByText("STAGING")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.tertiary });
  expect(logger.error).not.toHaveBeenCalled();
});

it("warns in red and logs when the API and the realm disagree", () => {
  show("mixed");

  expect(screen.getByText("BLANDAD MILJÖ")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.error });
  expect(logger.error).toHaveBeenCalledWith("App environment mismatch", expect.any(Object));
});

it("sits below the status bar and lets touches through", () => {
  show("staging");

  const badge = screen.getByTestId("environment-badge");
  // renderWithProviders gives a 47 pt top inset. keep-comment: fixture value
  expect(badge).toHaveStyle({ top: 47 });
  expect(badge).toHaveProp("pointerEvents", "none");
});
