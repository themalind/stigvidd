// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary, getErrorMessage } from "react-error-boundary";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";

interface ErrorFallbackProps {
  message: string;
  retry: () => void;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: (props: ErrorFallbackProps) => ReactNode;
  resetKeys?: unknown[];
}

function defaultErrorFallback({ message, retry }: ErrorFallbackProps) {
  return <ErrorState message={message} onRetry={retry} />;
}

export function QueryBoundary({
  children,
  fallback = <LoadingState />,
  errorFallback = defaultErrorFallback,
  resetKeys,
}: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={resetKeys}
          fallbackRender={({ error, resetErrorBoundary }) =>
            errorFallback({ message: getErrorMessage(error) ?? "Something went wrong.", retry: resetErrorBoundary })
          }
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
