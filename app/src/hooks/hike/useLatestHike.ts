// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import { Hike } from "@/data/types";
import { useMyHikes } from "@/hooks/hike/useMyHikes";
import { useIsOnline } from "@/hooks/useIsOnline";
import { latestHike } from "@/utils/hike-stats";
import { useAtomValue } from "jotai";
import { useMemo } from "react";

export type LatestHikeState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "error"; retry: () => void }
  | { kind: "signedOut" }
  | { kind: "empty" }
  | { kind: "hike"; hike: Hike };

// Which of the home screen's two personal cards to show: the get-started card opens the
// page, the latest-hike card sits below the carousel. Only one renders at a time.
export function useLatestHike(): LatestHikeState {
  const { isAuthenticated } = useAuth();
  const user = useAtomValue(stigviddUserAtom);
  const isOnline = useIsOnline();

  const { data: hikes, isError, refetch } = useMyHikes();

  const hike = useMemo(() => (hikes ? latestHike(hikes) : undefined), [hikes]);

  // Checked first: signed-out needs no query, so the card renders on the first pass instead
  // of appearing later and pushing the page down.
  if (!isAuthenticated) return { kind: "signedOut" };
  if (hikes) return hike ? { kind: "hike", hike } : { kind: "empty" };
  if (!isOnline) return { kind: "offline" };
  // A failed profile leaves the hikes query disabled, so it would never leave loading.
  if (user.isError && !user.data) return { kind: "error", retry: () => void user.refetch() };
  if (isError) return { kind: "error", retry: () => void refetch() };
  return { kind: "loading" };
}
