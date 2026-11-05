// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeProvider from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";
import useTheme from "./use-theme";

function prefersDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: dark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  document.documentElement.classList.remove("light", "dark");
});

describe("ThemeToggle", () => {
  it("starts from the system preference", () => {
    prefersDark(true);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("switches the page between light and dark", async () => {
    prefersDark(false);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("light");

    await userEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(document.documentElement).toHaveClass("light");
  });
});

describe("useTheme", () => {
  it("refuses to run outside a ThemeProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useTheme())).toThrow("useTheme must be used within a ThemeProvider");
  });
});
