// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserMappingCard from "./user-mapping-card";

const api = vi.hoisted(() => ({
  getUserMappings: vi.fn(),
  saveUserMapping: vi.fn(),
  deleteUserMapping: vi.fn(),
  searchKeycloakUsers: vi.fn(),
}));
vi.mock("@/api/user-mappings", () => api);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

beforeEach(() => {
  vi.clearAllMocks();
  api.getUserMappings.mockResolvedValue({
    users: [
      { id: 7, nickName: "user-7", email: "user-7@example.invalid", hikeCount: 3, isMapped: false },
      { id: 8, nickName: "user-8", email: "user-8@example.invalid", hikeCount: 0, isMapped: true },
    ],
    mappings: [
      {
        packageUserId: 8,
        keycloakSubjectId: "sub-8",
        keycloakUsername: "eva@example.se",
        nickName: "Eva",
        email: "eva@example.se",
      },
    ],
  });
  api.searchKeycloakUsers.mockResolvedValue([
    { id: "sub-1", username: "anna@example.se", email: "anna@example.se", enabled: true },
  ]);
  api.saveUserMapping.mockResolvedValue(undefined);
  api.deleteUserMapping.mockResolvedValue(undefined);
});

describe("UserMappingCard", () => {
  it("saves the picked user against the picked Keycloak user with the nickname and email to keep", async () => {
    render(<UserMappingCard />);

    await userEvent.click(await screen.findByRole("button", { name: /user-7/ }));
    await userEvent.type(screen.getByLabelText(/Find the Keycloak user/), "anna");
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));
    await userEvent.click(await screen.findByRole("button", { name: /anna@example.se/ }));
    await userEvent.clear(screen.getByLabelText(/Nickname to keep/));
    await userEvent.type(screen.getByLabelText(/Nickname to keep/), "Anna");
    await userEvent.click(screen.getByRole("button", { name: "Save mapping" }));

    await waitFor(() =>
      expect(api.saveUserMapping).toHaveBeenCalledWith(7, {
        keycloakSubjectId: "sub-1",
        nickName: "Anna",
        email: "anna@example.se",
      }),
    );
  });

  it("does not search for fewer than three characters", async () => {
    render(<UserMappingCard />);

    await userEvent.type(await screen.findByLabelText(/Find the Keycloak user/), "an");

    expect(screen.getByRole("button", { name: /Search/ })).toBeDisabled();
  });

  it("will not save before both a user and a Keycloak user are picked", async () => {
    render(<UserMappingCard />);

    await screen.findByRole("button", { name: /user-7/ });

    expect(screen.getByRole("button", { name: "Save mapping" })).toBeDisabled();
  });

  it("removes a saved mapping", async () => {
    render(<UserMappingCard />);

    const saved = within(await screen.findByRole("list", { name: "Saved mappings" }));
    await userEvent.click(saved.getByRole("button", { name: /Remove mapping for user 8/ }));

    await waitFor(() => expect(api.deleteUserMapping).toHaveBeenCalledWith(8));
  });
});
