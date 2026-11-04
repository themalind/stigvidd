// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary, getErrorMessage } from "react-error-boundary";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKeys?: unknown[];
}

export function QueryBoundary({ children, fallback = <LoadingState />, resetKeys }: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={resetKeys}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorState message={getErrorMessage(error) ?? "Something went wrong."} onRetry={resetErrorBoundary} />
          )}
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
