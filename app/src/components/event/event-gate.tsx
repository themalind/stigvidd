// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isApiStatus } from "@/api/api-error";
import ErrorScreen from "@/components/error-screen";
import LoadingIndicator from "@/components/loading-indicator";
import { HikingEvent } from "@/data/types";
import { useEvent } from "@/hooks/events/useEventQueries";
import { ReactNode } from "react";
import EventGoneView from "./event-gone-view";

type Props = {
  identifier: string;
  children: (event: HikingEvent, query: ReturnType<typeof useEvent>) => ReactNode;
};

// Loads an event and shows loading, gone or error until there is one to render. keep-comment: an old copy stays on screen when a refetch fails
export default function EventGate({ identifier, children }: Props) {
  const query = useEvent(identifier);
  const { data: event, isLoading, isError, error, refetch } = query;

  if (isLoading) return <LoadingIndicator />;
  if (isApiStatus(error, 404)) return <EventGoneView />;
  if (isError && !event) return <ErrorScreen error={error} onRetry={() => void refetch()} />;
  if (!event) return <EventGoneView />;
  return children(event, query);
}
