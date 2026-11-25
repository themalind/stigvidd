// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ErrorView from "@/components/status/error-view";
import { logger } from "@/services/logger";
import type { ErrorBoundaryProps } from "expo-router";
import { CommonActions, useNavigation, useRoute } from "expo-router/react-navigation";
import { useEffect } from "react";

export function logCrash(error: unknown): void {
  logger.error(
    "Screen crashed",
    error instanceof Error
      ? { name: error.name, errorMessage: error.message, stack: error.stack }
      : { name: typeof error, errorMessage: String(error) },
  );
}

// Replaces a tab's stack whose screen threw while rendering. keep-comment: a caught render error never reaches the global handler, hence the log
export default function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    logCrash(error);
  }, [error]);

  // keep-comment: a screen that throws on every render throws again on retry, and with its stack unmounted only the tab navigator can drop it
  const tabs = navigation.getState();
  const stackDepth = tabs?.routes.find((tab) => tab.key === route.key)?.state?.routes.length ?? 0;
  const backToStart =
    tabs && stackDepth > 1
      ? () => {
          // keep-comment: a retry before the reset lands renders the crashing screen once more
          const unsubscribe = navigation.addListener("state", () => {
            unsubscribe();
            void retry();
          });
          navigation.dispatch(
            CommonActions.reset({
              ...tabs,
              routes: tabs.routes.map((tab) => (tab.key === route.key ? { ...tab, state: undefined } : tab)),
            }),
          );
        }
      : undefined;

  return <ErrorView error={error} crashed onRetry={() => void retry()} onBackToStart={backToStart} />;
}
