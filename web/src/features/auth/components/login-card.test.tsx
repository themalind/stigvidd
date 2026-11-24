// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { paths } from "@/config/paths";
import { AuthContext, type AuthContextValue } from "@/features/auth/context/auth-context";
import { InvalidCredentialsError, NotAuthorizedError } from "@/lib/keycloak-auth";
import { LoginCard } from "./login-card";

const login = vi.fn<AuthContextValue["login"]>();

function show() {
  const auth: AuthContextValue = {
    user: null,
    stigviddUser: null,
    isLoading: false,
    isAuthenticated: false,
    getToken: vi.fn(),
    login,
    logout: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[paths.login]}>
        <Routes>
          <Route path={paths.login} element={<LoginCard />} />
          <Route path={paths.dashboard} element={<p>Dashboard page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

async function signIn(email = "admin@stigvidd.se", password = "hemligt123") {
  await userEvent.type(screen.getByLabelText("Epost"), email);
  await userEvent.type(screen.getByLabelText("Lösenord"), password);
  await userEvent.click(screen.getByRole("button", { name: "Logga in" }));
}

beforeEach(() => {
  login.mockReset();
});

it("signs in with what was typed and goes to the dashboard", async () => {
  login.mockResolvedValue(undefined);
  show();

  await signIn();

  expect(login).toHaveBeenCalledWith("admin@stigvidd.se", "hemligt123");
  expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
});

describe("when the sign-in fails", () => {
  it.each([
    ["a wrong password", new InvalidCredentialsError(), "Invalid email or password."],
    [
      "an account without the admin role",
      new NotAuthorizedError(),
      "Du har inte behörighet till administrationsverktyget.",
    ],
    ["anything else", new Error("504"), "Something went wrong. Please try again."],
  ])("names %s and stays on the form", async (_case, error, message) => {
    login.mockRejectedValue(error);
    show();

    await signIn();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logga in" })).toBeEnabled();
  });

  it("clears the old message when the form is sent again", async () => {
    login.mockRejectedValueOnce(new InvalidCredentialsError()).mockReturnValueOnce(new Promise(() => {}));
    show();

    await signIn();
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Logga in" }));

    expect(screen.getByRole("button", { name: "Loggar in..." })).toBeDisabled();
    expect(screen.queryByText("Invalid email or password.")).not.toBeInTheDocument();
  });
});

it("disables the button and says so while the sign-in runs", async () => {
  login.mockReturnValue(new Promise(() => {}));
  show();

  await signIn();

  expect(screen.getByRole("button", { name: "Loggar in..." })).toBeDisabled();
});
