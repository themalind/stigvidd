// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/api/mutator";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { errorMessage?: string };
    mutationMeta: { successMessage?: string; errorMessage?: string };
  }
}

// keep-comment: orval keys start with the request URL; matching on a path boundary keeps /sessions/1 from catching /sessions/12
export function underUrl(prefix: string) {
  return {
    predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => {
      const url = queryKey[0];
      return (
        typeof url === "string" && (url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`))
      );
    },
  };
}

const MAX_RETRIES = 2;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  // keep-comment: a polling query that keeps failing would toast every tick; a run of failures toasts once, until a success
  const failing = new WeakSet<object>();

  return new QueryClient({
    queryCache: new QueryCache({
      // A first-load failure goes to the page's error boundary; only a failed background refetch toasts. keep-comment: tkdodo.eu/blog/react-query-error-handling
      onError: (error, query) => {
        if (query.state.data !== undefined && !failing.has(query)) {
          toast.error(query.meta?.errorMessage ?? error.message);
        }
        failing.add(query);
      },
      onSuccess: (_data, query) => {
        failing.delete(query);
      },
    }),
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage);
      },
      onError: (error, _variables, _context, mutation) => {
        toast.error(mutation.meta?.errorMessage ?? error.message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
