// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getFriends } from "@/api/friends";
import { userAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { FRIENDS_STALE_TIME } from "@/constants/cache";
import { BORDER_RADIUS, MAX_SHARE_RECIPIENTS } from "@/constants/constants";
import { FriendResponse } from "@/data/types";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Checkbox, Divider, Icon, Text, useTheme } from "react-native-paper";

interface Props {
  enabled: boolean;
  onShare: (friendNickNames: string[]) => void;
  isPending?: boolean;
  excludeNickNames?: string[];
}

export default function FriendPicker({ enabled, onShare, isPending, excludeNickNames }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const currentUser = useAtomValue(stigviddUserAtom);
  const authUser = useAtomValue(userAtom);
  const [selected, setSelected] = useState<string[]>([]);

  const { data: friendsRaw, isLoading } = useQuery({
    // keep-comment: same key as friendsAtom, so the picker and the friends screen share one cache entry
    queryKey: ["friends", authUser?.id],
    queryFn: getFriends,
    enabled,
    staleTime: FRIENDS_STALE_TIME,
  });

  const friends = friendsRaw?.filter(
    (f) => f.nickName !== currentUser.data?.nickName && !excludeNickNames?.includes(f.nickName),
  );

  const atLimit = selected.length >= MAX_SHARE_RECIPIENTS;

  const toggle = (nickName: string) =>
    setSelected((prev) => (prev.includes(nickName) ? prev.filter((n) => n !== nickName) : [...prev, nickName]));

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!friends || friends.length === 0) {
    return (
      <View style={s.centered}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>{t("hike.noFriendsToShare")}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView bounces={false} style={s.flex}>
        {friends.map((item: FriendResponse, index: number) => {
          const checked = selected.includes(item.nickName);
          return (
            <View key={item.identifier}>
              <Pressable
                style={({ pressed }) => [s.friendItem, pressed && { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => toggle(item.nickName)}
                disabled={isPending || (atLimit && !checked)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <Icon size={22} source="account" color={theme.colors.primary} />
                <Text style={s.nickName}>{item.nickName}</Text>
                <Checkbox.Android
                  status={checked ? "checked" : "unchecked"}
                  color={theme.colors.primary}
                  uncheckedColor={theme.colors.onSurfaceVariant}
                />
              </Pressable>
              {index < friends.length - 1 && <Divider />}
            </View>
          );
        })}
      </ScrollView>
      <Divider />
      <View style={s.buttonContainer}>
        {atLimit && (
          <Text style={[s.limitHint, { color: theme.colors.onSurfaceVariant }]}>
            {t("hike.shareLimitReached", { max: MAX_SHARE_RECIPIENTS })}
          </Text>
        )}
        <Button
          mode="contained"
          icon="share"
          style={s.button}
          onPress={() => onShare(selected)}
          disabled={selected.length === 0 || isPending}
          loading={isPending}
        >
          {selected.length === 0 ? t("hike.selectFriends") : t("hike.shareWithCount", { count: selected.length })}
        </Button>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 8,
  },
  nickName: {
    flex: 1,
    fontSize: 16,
  },
  centered: {
    padding: 30,
    alignItems: "center",
  },
  buttonContainer: {
    padding: 16,
    alignItems: "center",
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
  limitHint: {
    marginBottom: 8,
    textAlign: "center",
  },
  flex: {
    flex: 1,
  },
});
