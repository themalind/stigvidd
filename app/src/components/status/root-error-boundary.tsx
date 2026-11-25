// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ErrorView from "@/components/status/error-view";
import { logCrash } from "@/components/status/route-error-boundary";
import { useUserTheme } from "@/hooks/theme/useUserTheme";
import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { PaperProvider } from "react-native-paper";

// Replaces the whole app when the root layout threw. keep-comment: the crash took the layout's PaperProvider with it, so the theme is provided again here
export default function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useUserTheme();

  useEffect(() => {
    logCrash(error);
  }, [error]);

  return (
    <PaperProvider theme={theme}>
      <ErrorView error={error} crashed onRetry={() => void retry()} />
    </PaperProvider>
  );
}
