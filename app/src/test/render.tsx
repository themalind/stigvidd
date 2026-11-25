// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { AppDefaultTheme, AppTheme } from "@/constants/theme";
import { ThemeProvider } from "expo-router/react-navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, RenderOptions } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider, WritableAtom } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { ReactElement, ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { rememberQueryClient } from "./tree";
import "@/i18n";

// keep-comment: without explicit metrics the safe-area provider never mounts its children under Jest
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// keep-comment: a derived atom that a test mocks as a primitive is cast to this
export type SeededAtom = [WritableAtom<unknown, [never], unknown>, unknown];

interface Options extends Omit<RenderOptions, "wrapper"> {
  initialAtoms?: SeededAtom[];
  theme?: AppTheme;
}

export async function renderWithProviders(
  ui: ReactElement,
  { initialAtoms = [], theme = AppDefaultTheme, ...options }: Options = {},
) {
  // keep-comment: retries hang a failed test; notifyOnChangeProps "all", or a probe reading the result
  // keep-comment: after render gets a stale value silently (docs/notes/react-query-tracked-props.md)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // keep-comment: setQueryData on a key nothing observes is dropped at once; seed with setQueryDefaults(root, { gcTime: Infinity })
        gcTime: 0,
        notifyOnChangeProps: "all",
        // keep-comment: as the app's client, so an offline test fails instead of pausing
        networkMode: "always",
        refetchOnReconnect: true,
      },
      mutations: { retry: false, gcTime: 0, networkMode: "always" },
    },
  });
  const store = createStore();
  // keep-comment: or the query atoms build a second client whose gcTime timer keeps Jest alive
  // keep-comment: (docs/notes/jotai-query-atom-builds-its-own-queryclient.md)
  store.set(queryClientAtom, queryClient);
  // keep-comment: jest.after-env.js disposes it, since a hook's gcTime can outlive the test
  rememberQueryClient(queryClient);
  for (const [atom, value] of initialAtoms) {
    store.set(atom, value as never);
  }

  // keep-comment: scale 0, so Paper's 220 ms exit animation unmounts on the next tick
  const instantTheme = { ...theme, animation: { ...theme.animation, scale: 0 } };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <SafeAreaProvider initialMetrics={METRICS}>
          <GestureHandlerRootView>
            <PaperProvider theme={instantTheme}>
              <ThemeProvider value={theme}>{children}</ThemeProvider>
            </PaperProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </JotaiProvider>
    </QueryClientProvider>
  );

  const rendered = await render(ui, { wrapper: Wrapper, ...options });

  return { store, queryClient, theme, ...rendered };
}
