// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isUnauthorized } from "@/api/unauthorized";
import { userAtom } from "@/atoms/auth-atoms";
import { handleUnauthorized, UnauthorizedOutcome } from "@/services/keycloak-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useEffect } from "react";

export function SessionRecovery() {
  const queryClient = useQueryClient();
  const signedIn = !!useAtomValue(userAtom);

  useEffect(() => {
    if (!signedIn) return;

    const recover = (error: unknown) => {
      if (!isUnauthorized(error)) return;
      void handleUnauthorized().then((outcome: UnauthorizedOutcome) => {
        if (outcome === "refreshed") void queryClient.invalidateQueries();
      });
    };

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") recover(event.action.error);
    });
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") recover(event.action.error);
    });

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient, signedIn]);

  return null;
}
