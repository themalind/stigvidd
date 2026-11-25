// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userThemeAtom } from "@/atoms/user-theme-atom";
import { AppDarkTheme } from "@/constants/theme";
import RootErrorBoundary from "@/components/status/root-error-boundary";
import { logCrash } from "@/components/status/route-error-boundary";
import "@/i18n";
import sv from "@/i18n/locales/sv.json";
import { logger } from "@/services/logger";
import { render, screen } from "@testing-library/react-native";
import { getDefaultStore } from "jotai";

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: false, logout: jest.fn() }),
}));
jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

beforeEach(() => {
  jest.mocked(logger.error).mockClear();
  getDefaultStore().set(userThemeAtom, "petroleum");
});

describe("the root boundary", () => {
  it("renders without the root layout's providers, which a crash there takes with it", async () => {
    await render(<RootErrorBoundary error={new Error("boom")} retry={() => Promise.resolve()} />);

    expect(screen.getByText(sv.error.default.title)).toBeTruthy();
  });

  it("keeps a dark-theme user's dark background", async () => {
    getDefaultStore().set(userThemeAtom, "bivack");
    await render(<RootErrorBoundary error={new Error("boom")} retry={() => Promise.resolve()} />);

    expect(screen.getByText(sv.error.default.title).parent).toHaveStyle({
      backgroundColor: AppDarkTheme.colors.background,
    });
  });

  it("logs the crash once, since a caught render error never reaches the global handler", async () => {
    const error = new TypeError("Cannot read property 'name' of undefined");
    await render(<RootErrorBoundary error={error} retry={() => Promise.resolve()} />);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Screen crashed",
      expect.objectContaining({ name: "TypeError", errorMessage: error.message }),
    );
  });
});

it("logs something thrown that is not an Error without throwing itself", () => {
  expect(() => logCrash(undefined)).not.toThrow();

  expect(logger.error).toHaveBeenCalledWith("Screen crashed", { name: "undefined", errorMessage: "undefined" });
});
