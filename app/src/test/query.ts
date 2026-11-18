// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { QueryClient, QueryKey } from "@tanstack/react-query";

// keep-comment: resolves a staleTime declared as a function of the query
export function staleTimeOf(queryClient: QueryClient, queryKey: QueryKey): number | undefined {
  const query = queryClient.getQueryCache().find({ queryKey });
  const option = (query?.options as { staleTime?: number | ((query: unknown) => number) } | undefined)?.staleTime;
  return typeof option === "function" ? option(query) : option;
}
