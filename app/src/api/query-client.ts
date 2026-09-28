// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { QueryClient } from "@tanstack/react-query";
import { retryUnlessAuthFailure } from "./unauthorized";

// "always": offline, a request fails into the error UI instead of pausing into a state no screen renders. keep-comment: screens branch on isLoading/isError only
// "always" silently defaults refetchOnReconnect to false, so it is set explicitly. keep-comment: hidden library default
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: retryUnlessAuthFailure, networkMode: "always", refetchOnReconnect: true },
      mutations: { networkMode: "always" },
    },
  });
}
