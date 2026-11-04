// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/mutator";
import { QueryBoundary } from "@/components/query-boundary";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

import UserMappingCard from "./user-mapping-card";

const MAPPINGS = "/api/v1/admin/user-mappings";
const SEARCH = "/api/v1/admin/keycloak-users";

const EVA = {
  packageUserId: 8,
  keycloakSubjectId: "sub-8",
  keycloakUsername: "eva@example.se",
  nickName: "Eva",
  email: "eva@example.se",
  createdAt: "2026-10-01T00:00:00Z",
};

let mappings = [EVA];

function renderCard() {
  return renderWithProviders(
    <QueryBoundary>
      <UserMappingCard />
    </QueryBoundary>,
  );
}

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

async function pickAnnaFor(user: RegExp) {
  await userEvent.click(await screen.findByRole("button", { name: user }));
  await userEvent.type(screen.getByLabelText(/Find the Keycloak user/), "anna");
  await userEvent.click(screen.getByRole("button", { name: /Search/ }));
  await userEvent.click(await screen.findByRole("button", { name: /anna@example.se/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  mappings = [EVA];
  api.mock.on("GET", MAPPINGS, () => ({
    users: [
      { id: 7, nickName: "user-7", email: "user-7@example.invalid", hikeCount: 3, isMapped: false },
      { id: 8, nickName: "user-8", email: "user-8@example.invalid", hikeCount: 0, isMapped: true },
    ],
    mappings,
  }));
  api.mock.on("GET", SEARCH, () => [
    { id: "sub-1", username: "anna@example.se", email: "anna@example.se", enabled: true },
  ]);
  api.mock.on("PUT", `${MAPPINGS}/7`, () => undefined);
  api.mock.on("DELETE", `${MAPPINGS}/8`, () => {
    mappings = [];
    return undefined;
  });
});

describe("UserMappingCard", () => {
  it("saves the picked user against the picked Keycloak user with the nickname and email to keep", async () => {
    renderCard();

    await pickAnnaFor(/user-7/);
    await userEvent.clear(screen.getByLabelText(/Nickname to keep/));
    await userEvent.type(screen.getByLabelText(/Nickname to keep/), "Anna");
    await userEvent.click(screen.getByRole("button", { name: "Save mapping" }));

    await waitFor(() => expect(calls("PUT", `${MAPPINGS}/7`)).toHaveLength(1));
    expect(calls("PUT", `${MAPPINGS}/7`)[0].body).toEqual({
      keycloakSubjectId: "sub-1",
      nickName: "Anna",
      email: "anna@example.se",
    });
  });

  it("searches Keycloak for exactly what was typed", async () => {
    renderCard();

    await userEvent.type(await screen.findByLabelText(/Find the Keycloak user/), "  anna ");
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));

    await waitFor(() => expect(calls("GET", SEARCH)).toHaveLength(1));
    expect(calls("GET", SEARCH)[0].url).toBe(`${SEARCH}?search=anna`);
  });

  it("asks Keycloak again when the same search is repeated", async () => {
    renderCard();

    await userEvent.type(await screen.findByLabelText(/Find the Keycloak user/), "anna");
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));
    await screen.findByRole("button", { name: /anna@example.se/ });
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));

    await waitFor(() => expect(calls("GET", SEARCH)).toHaveLength(2));
  });

  it("prefills the email and a nickname from the picked Keycloak user", async () => {
    renderCard();

    await pickAnnaFor(/user-7/);

    expect(screen.getByLabelText(/Nickname to keep/)).toHaveValue("anna");
    expect(screen.getByLabelText(/Email to keep/)).toHaveValue("anna@example.se");
  });

  it("clears the form and reloads the mappings after a save", async () => {
    renderCard();
    await pickAnnaFor(/user-7/);

    await userEvent.click(screen.getByRole("button", { name: "Save mapping" }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Mapping saved and applied."));
    expect(screen.getByLabelText(/Nickname to keep/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save mapping" })).toBeDisabled();
    await waitFor(() => expect(calls("GET", MAPPINGS)).toHaveLength(2));
  });

  it("keeps what was entered when the save is refused", async () => {
    api.mock.on("PUT", `${MAPPINGS}/7`, () => {
      throw new ApiError("That Keycloak user is already mapped.", 409);
    });
    renderCard();
    await pickAnnaFor(/user-7/);

    await userEvent.click(screen.getByRole("button", { name: "Save mapping" }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("That Keycloak user is already mapped."));
    expect(screen.getByLabelText(/Nickname to keep/)).toHaveValue("anna");
    expect(screen.getByRole("button", { name: "Save mapping" })).toBeEnabled();
  });

  it("says why a search failed", async () => {
    api.mock.on("GET", SEARCH, () => {
      throw new ApiError("Keycloak did not answer.", 400);
    });
    renderCard();

    await userEvent.type(await screen.findByLabelText(/Find the Keycloak user/), "anna");
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Keycloak did not answer.");
  });

  it("filters the imported users by nickname or id", async () => {
    renderCard();
    const list = within(await screen.findByRole("list", { name: "Imported users" }));

    await userEvent.type(screen.getByLabelText(/Pick the imported user/), "8");

    expect(list.queryByRole("button", { name: /user-7/ })).not.toBeInTheDocument();
    expect(list.getByRole("button", { name: /user-8/ })).toBeInTheDocument();
  });

  it("does not search for fewer than three characters", async () => {
    renderCard();

    await userEvent.type(await screen.findByLabelText(/Find the Keycloak user/), "an");

    expect(screen.getByRole("button", { name: /Search/ })).toBeDisabled();
  });

  it("will not save before both a user and a Keycloak user are picked", async () => {
    renderCard();

    await userEvent.click(await screen.findByRole("button", { name: /user-7/ }));

    expect(screen.getByRole("button", { name: "Save mapping" })).toBeDisabled();
  });

  it("removes a saved mapping and shows the list without it", async () => {
    renderCard();

    const saved = within(await screen.findByRole("list", { name: "Saved mappings" }));
    await userEvent.click(saved.getByRole("button", { name: /Remove mapping for user 8/ }));

    await waitFor(() => expect(calls("DELETE", `${MAPPINGS}/8`)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Saved mappings" })).not.toBeInTheDocument());
  });
});
