// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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

import MailTemplatesPage from "./mail-templates";

const LIST = "/api/v1/admin/mail-templates";

function renderPage() {
  return renderWithProviders(
    <QueryBoundary>
      <MailTemplatesPage />
    </QueryBoundary>,
    { initialEntries: ["/mail-templates"] },
  );
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    identifier: "tpl-1",
    key: "verify-email",
    language: "sv",
    subject: "Bekräfta din e-postadress",
    lastUpdatedAt: "2026-09-12T00:00:00Z",
    isKnown: true,
    unknownTokenCount: 0,
    missingTokenCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  api.mock.reset();
});

describe("the mail template list", () => {
  it("links each template to its editor", async () => {
    api.mock.on("GET", LIST, () => [row()]);

    renderPage();

    const link = await screen.findByRole("link", { name: /verify-email/ });
    expect(link).toHaveAttribute("href", "/mail-templates/tpl-1");
  });

  it("flags a template that cannot be sent and one no code sends", async () => {
    api.mock.on("GET", LIST, () => [row({ isKnown: false, unknownTokenCount: 2, missingTokenCount: 1 })]);

    renderPage();

    expect(await screen.findByText("Not sent by any code")).toBeInTheDocument();
    expect(screen.getByText(/Uses 2 placeholders this template does not supply/)).toBeInTheDocument();
    expect(screen.getByText(/1 available placeholder is unused/)).toBeInTheDocument();
  });

  it("says so when there are none", async () => {
    api.mock.on("GET", LIST, () => []);

    renderPage();

    expect(await screen.findByText("No mail templates exist yet.")).toBeInTheDocument();
  });
});
