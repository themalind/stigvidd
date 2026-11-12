// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getTrailLike, likeTrail, unlikeTrail } from "@/api/trails";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import { TRAIL_LIKES_STALE_TIME } from "@/constants/cache";
import { HikeSubmission, Trail, TrailCard, TrailLike } from "@/data/types";
import { HIKE_SUBMISSIONS_QUERY_ROOT } from "@/hooks/hike/useMyHikeSubmissions";
import { POPULAR_CONTRIBUTIONS_QUERY_ROOT } from "@/hooks/trail/usePopularContributions";
import { QueryClient, skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

export const trailLikeQueryKey = (identifier: string, userId: string | undefined) =>
  ["trailLike", identifier, userId] as const;

// keep-comment: the trail page, the home cards and the user's own submissions each cache the count in their own query
export function syncTrailLikeCount(queryClient: QueryClient, identifier: string, likeCount: number) {
  queryClient.setQueriesData<Trail>({ queryKey: ["trail"] }, (trail) =>
    trail?.identifier === identifier && trail.contribution
      ? { ...trail, contribution: { ...trail.contribution, likeCount } }
      : trail,
  );
  queryClient.setQueriesData<TrailCard[]>({ queryKey: POPULAR_CONTRIBUTIONS_QUERY_ROOT }, (cards) =>
    Array.isArray(cards)
      ? cards.map((card) =>
          card.identifier === identifier && card.contribution
            ? { ...card, contribution: { ...card.contribution, likeCount } }
            : card,
        )
      : cards,
  );
  queryClient.setQueriesData<HikeSubmission[]>({ queryKey: [HIKE_SUBMISSIONS_QUERY_ROOT] }, (submissions) =>
    Array.isArray(submissions)
      ? submissions.map((submission) =>
          submission.publishedTrailIdentifier === identifier ? { ...submission, likeCount } : submission,
        )
      : submissions,
  );
}

export function useTrailLike(trailIdentifier: string, fallbackLikeCount: number) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const queryKey = trailLikeQueryKey(trailIdentifier, user?.id);

  const { data } = useQuery({
    queryKey,
    queryFn: isAuthenticated ? () => getTrailLike(trailIdentifier) : skipToken,
    staleTime: TRAIL_LIKES_STALE_TIME,
  });

  const like: TrailLike = data ?? { likeCount: fallbackLikeCount, likedByMe: false };

  const mutation = useMutation({
    mutationFn: (liked: boolean) => (liked ? likeTrail(trailIdentifier) : unlikeTrail(trailIdentifier)),
    onMutate: async (liked) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TrailLike>(queryKey);
      queryClient.setQueryData<TrailLike>(queryKey, {
        likeCount: Math.max(0, like.likeCount + (liked ? 1 : -1)),
        likedByMe: liked,
      });
      return { previous };
    },
    onError: (_error, _liked, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      setErrorMsg(t("trail.likeError"));
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      syncTrailLikeCount(queryClient, trailIdentifier, result.likeCount);
    },
  });

  // keep-comment: until the user's own like has loaded, a press would guess likedByMe and could like when meaning to unlike
  const canPress = !isAuthenticated || (data !== undefined && !mutation.isPending);

  return { like, canPress, isAuthenticated, toggle: () => mutation.mutate(!like.likedByMe) };
}
