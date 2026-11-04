// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from "react-router";
import { similarRoutesQueryOptions, submissionQueryOptions } from "@/features/hike-submissions/api/hike-submissions";
import { mailTemplateQueryOptions } from "@/features/mail/api/mail-templates";
import { sessionQueryOptions } from "@/features/trail-import/api/trail-import";
import { trailsQueryOptions } from "@/features/trails/api/trail";
import { hasSession } from "@/lib/keycloak-auth";

// keep-comment: not awaited - the page renders its Suspense skeleton at once and its useSuspenseQuery joins the request already in flight
export function detailLoaders(client: QueryClient) {
  const start = (prefetch: () => void) => {
    if (hasSession()) prefetch();
    return null;
  };

  return {
    hikeSubmission: ({ params }: LoaderFunctionArgs) =>
      start(() => {
        const identifier = params.identifier ?? "";
        void client.prefetchQuery(submissionQueryOptions(identifier));
        void client.prefetchQuery(similarRoutesQueryOptions(identifier));
      }),
    mailTemplate: ({ params }: LoaderFunctionArgs) =>
      start(() => void client.prefetchQuery(mailTemplateQueryOptions(params.identifier ?? ""))),
    trailImportSession: ({ params }: LoaderFunctionArgs) =>
      start(() => {
        void client.prefetchQuery(sessionQueryOptions(Number(params.sessionId)));
        void client.prefetchQuery(trailsQueryOptions());
      }),
  };
}

// keep-comment: React Router reruns loaders on every search-param change, and these pages keep their filters there
export function onlyWhenParamsChange({ currentParams, nextParams }: ShouldRevalidateFunctionArgs): boolean {
  return Object.keys({ ...currentParams, ...nextParams }).some((key) => currentParams[key] !== nextParams[key]);
}
