// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import ThemeProvider from "@/components/theme/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import Header from "./header";

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
});

function renderAt(title?: string) {
  const router = createMemoryRouter([{ path: "/", handle: { title }, element: <Header /> }]);
  return render(
    <ThemeProvider>
      <SidebarProvider>
        <RouterProvider router={router} />
      </SidebarProvider>
    </ThemeProvider>,
  );
}

describe("Header", () => {
  it("names the browser tab after the open page", async () => {
    renderAt("Mail Outbox");

    expect(screen.getByRole("heading", { name: "Mail Outbox" })).toBeVisible();
    await waitFor(() => expect(document.title).toMatch(/^(\[STAGING\] )?Mail Outbox$/));
  });

  it("falls back to the product name on a page without a title", async () => {
    renderAt();

    await waitFor(() => expect(document.title).toMatch(/^(\[STAGING\] )?Stigvidd$/));
  });
});
