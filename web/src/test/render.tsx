// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  client?: QueryClient;
  initialEntries?: string[];
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const { client = createTestQueryClient(), initialEntries, ...renderOptions } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = initialEntries ? <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter> : children;
    return <QueryClientProvider client={client}>{tree}</QueryClientProvider>;
  }

  return { client, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
