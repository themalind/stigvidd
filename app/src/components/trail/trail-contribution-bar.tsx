// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import ContributionInfo from "@/components/trail/contribution-info";
import { BORDER_RADIUS } from "@/constants/constants";
import { TrailContribution } from "@/data/types";
import { useTrailLike } from "@/hooks/trail/useTrailLike";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface Props {
  trailIdentifier: string;
  contribution: TrailContribution;
}

export default function TrailContributionBar({ trailIdentifier, contribution }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [showAuthDialog, setAuthDialog] = useState(false);
  const { like, canPress, isAuthenticated, toggle } = useTrailLike(trailIdentifier, contribution.likeCount);

  const onPress = () => {
    if (!isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    toggle();
  };

  return (
    <View
      testID="trail-contribution"
      style={[s.container, { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.primary }]}
    >
      <View style={s.byline}>
        <View style={s.badgeRow}>
          <Text style={[s.badge, { color: theme.colors.primary }]}>{t("trail.contributed")}</Text>
          <ContributionInfo testID="trail-contribution-info" />
        </View>
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
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: like.likedByMe, disabled: !canPress }}
        accessibilityLabel={like.likedByMe ? t("trail.liked") : t("trail.like")}
        hitSlop={8}
        style={({ pressed }) => [s.likeButton, pressed && s.pressed]}
      >
        <Icon source={like.likedByMe ? "thumb-up" : "thumb-up-outline"} size={20} color={theme.colors.primary} />
        <Text testID="trail-like-count" style={[s.likeCount, { color: theme.colors.primary }]}>
          {like.likeCount}
        </Text>
      </Pressable>
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage={t("trail.notAuthLike")}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderLeftWidth: 4,
    borderRadius: BORDER_RADIUS,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
  },
  byline: {
    flex: 1,
    gap: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  },
  pressed: {
    opacity: 0.6,
  },
  likeCount: {
    fontFamily: "Inter_600SemiBold",
  },
});
