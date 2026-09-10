// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, RenderOptions } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { ReactElement, ReactNode } from "react";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { rememberQueryClient, rememberRender } from "./tree";
import "@/i18n";

// react-native-safe-area-context reads native insets that do not exist under Jest, and without
// explicit metrics its children never mount.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// The providers src/app/_layout.tsx mounts above every screen. A component that reads a query, an
// atom or the theme crashes without them.
interface Options extends Omit<RenderOptions, "wrapper"> {
  // Atom values to seed before the first render, as [atom, value] pairs.
  initialAtoms?: [any, unknown][];
  // The theme to render under; the app passes one to both providers. Pass AppDarkTheme for dark mode.
  theme?: typeof AppDefaultTheme | typeof AppDarkTheme;
}

export function renderWithProviders(
  ui: ReactElement,
  { initialAtoms = [], theme = AppDefaultTheme, ...options }: Options = {},
) {
  // Retries turn a failed query into a hung test, and gcTime 0 keeps nothing cached between renders.
  // notifyOnChangeProps "all" turns off React Query's tracked-props optimisation, under which an
  // observer is only notified about result fields something read during render — so a test probe
  // that holds the whole result and reads it afterwards never re-renders on a data-only change,
  // and reads a stale value with no error. See docs/notes/react-query-tracked-props.md.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, notifyOnChangeProps: "all" },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const store = createStore();
  // src/app/_layout.tsx hands the app's client to this atom. Without it the query atoms build a
  // second QueryClient whose five-minute gcTime timer keeps the Jest process alive; see
  // docs/notes/jotai-query-atom-builds-its-own-queryclient.md.
  store.set(queryClientAtom, queryClient);
  // Disposed by jest.after-env.js: a query hook may set a gcTime far longer than the test.
  rememberQueryClient(queryClient);
  for (const [atom, value] of initialAtoms) {
    store.set(atom, value);
  }

  // Paper animates a modal or dialog out over 220 ms before unmounting it. theme.animation.scale
  // multiplies those durations; at 0 the exit lands on the first tick after the state change.
  const instantTheme = { ...theme, animation: { ...theme.animation, scale: 0 } };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <SafeAreaProvider initialMetrics={METRICS}>
          <PaperProvider theme={instantTheme}>
            <ThemeProvider value={theme}>{children}</ThemeProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </JotaiProvider>
    </QueryClientProvider>
  );

  const rendered = render(ui, { wrapper: Wrapper, ...options });
  // Handed to jest.after-env.js, which checks every rendered tree for strings outside a Text.
  rememberRender(rendered);

  return { store, queryClient, theme, ...rendered };
}
