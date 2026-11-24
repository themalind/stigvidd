// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { paths } from "@/config/paths";
import { AuthContext, type AuthContextValue } from "@/features/auth/context/auth-context";
import { NavUser } from "./nav-user";

const logout = vi.fn<AuthContextValue["logout"]>();

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  logout.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function show(auth: Partial<AuthContextValue>) {
  const value: AuthContextValue = {
    user: null,
    stigviddUser: null,
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn(),
    login: vi.fn(),
    logout,
    ...auth,
  };
  render(
    <AuthContext.Provider value={value}>
      <SidebarProvider>
        <MemoryRouter initialEntries={[paths.dashboard]}>
          <Routes>
            <Route path={paths.dashboard} element={<NavUser />} />
            <Route path={paths.login} element={<p>Login page</p>} />
          </Routes>
        </MemoryRouter>
      </SidebarProvider>
    </AuthContext.Provider>,
  );
}

const STIGVIDD_USER = { nickName: "stigfinnare", email: "stig@stigvidd.se" } as AuthContextValue["stigviddUser"];

it("shows the Stigvidd nickname, its email and initials", () => {
  show({ stigviddUser: STIGVIDD_USER });

  expect(screen.getByText("stigfinnare")).toBeInTheDocument();
  expect(screen.getByText("stig@stigvidd.se")).toBeInTheDocument();
  expect(screen.getByText("ST")).toBeInTheDocument();
});

it("falls back to the sign-in email when the Stigvidd profile has not loaded", () => {
  show({ user: { email: "admin@stigvidd.se" } as AuthContextValue["user"] });

  expect(screen.getAllByText("admin@stigvidd.se")).toHaveLength(2);
  expect(screen.getByText("AD")).toBeInTheDocument();
});

it("logs out and goes to the login page", async () => {
  show({ stigviddUser: STIGVIDD_USER });

  await userEvent.click(screen.getByRole("button", { name: /stigfinnare/ }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Log out" }));

  expect(logout).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("Login page")).toBeInTheDocument();
});
