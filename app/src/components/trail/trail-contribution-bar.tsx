// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getTrailLike, likeTrail, unlikeTrail } from "@/api/trails";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import { CONTRIBUTION_MARKER_COLORS } from "@/components/map/marker-styles";
import { BORDER_RADIUS } from "@/constants/constants";
import { TrailContribution, TrailLike } from "@/data/types";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

export const trailLikeQueryKey = (identifier: string, userId: string | undefined) =>
  ["trailLike", identifier, userId] as const;

interface Props {
  trailIdentifier: string;
  contribution: TrailContribution;
}

export default function TrailContributionBar({ trailIdentifier, contribution }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const queryKey = trailLikeQueryKey(trailIdentifier, user?.id);
  const accent = CONTRIBUTION_MARKER_COLORS.fill;

  const { data } = useQuery({
    queryKey,
    queryFn: isAuthenticated ? () => getTrailLike(trailIdentifier) : skipToken,
  });

  const like: TrailLike = data ?? { likeCount: contribution.likeCount, likedByMe: false };

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
    onSuccess: (result) => queryClient.setQueryData(queryKey, result),
  });

  // keep-comment: until the user's own like has loaded, a press would guess likedByMe and could like when meaning to unlike
  const canPress = isAuthenticated && data !== undefined && !mutation.isPending;

  return (
    <View testID="trail-contribution" style={s.container}>
      <View style={s.byline}>
        <Text style={[s.badge, { color: accent }]}>{t("trail.contributed")}</Text>
        {contribution.submitterNickName && (
          <View style={s.submitter}>
            <Icon source="account-outline" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t("trail.sharedBy", { nickName: contribution.submitterNickName })}
            </Text>
          </View>
        )}
      </View>
      <Pressable
        testID="trail-like"
        disabled={!canPress}
        onPress={() => mutation.mutate(!like.likedByMe)}
        accessibilityRole="button"
        accessibilityState={{ selected: like.likedByMe, disabled: !canPress }}
        accessibilityLabel={like.likedByMe ? t("trail.liked") : t("trail.like")}
        style={[
          s.likeButton,
          { borderColor: accent, backgroundColor: like.likedByMe ? accent : "transparent" },
          !isAuthenticated && s.disabled,
        ]}
      >
        <Icon
          source={like.likedByMe ? "thumb-up" : "thumb-up-outline"}
          size={20}
          color={like.likedByMe ? CONTRIBUTION_MARKER_COLORS.stroke : accent}
        />
        <Text
          testID="trail-like-count"
          style={[s.likeCount, { color: like.likedByMe ? CONTRIBUTION_MARKER_COLORS.stroke : accent }]}
        >
          {like.likeCount}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  byline: {
    flex: 1,
    gap: 2,
  },
  badge: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  submitter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
  },
  likeCount: {
    fontFamily: "Inter_600SemiBold",
  },
  disabled: {
    opacity: 0.6,
  },
});
