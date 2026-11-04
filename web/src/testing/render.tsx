// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactElement, ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { createQueryClient } from "@/lib/react-query";

export function createTestQueryClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    mutations: { retry: false },
  });
  return client;
}

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  client?: QueryClient;
  initialEntries?: string[];
  path?: string;
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const { client = createTestQueryClient(), initialEntries, path, ...renderOptions } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    const routed = path ? (
      <Routes>
        <Route path={path} element={children} />
      </Routes>
    ) : (
      children
    );
    const tree = initialEntries ? <MemoryRouter initialEntries={initialEntries}>{routed}</MemoryRouter> : routed;
    return <QueryClientProvider client={client}>{tree}</QueryClientProvider>;
  }

  return { client, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
