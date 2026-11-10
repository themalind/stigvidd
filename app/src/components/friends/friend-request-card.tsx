// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import UserAvatar from "@/components/friends/user-avatar";
import OverflowMenu from "@/components/layout/overflow-menu";
import SlimButton from "@/components/display/slim-button";
import { BORDER_RADIUS } from "@/constants/constants";
import { FriendRequest } from "@/data/types";
import { formatDate } from "@/utils/format/format-date";
import { relativeDay } from "@/utils/format/relative-day";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const AVATAR = 44;

type Props = {
  request: FriendRequest;
  busy: boolean;
  onAccept: (request: FriendRequest) => void;
  onReject: (request: FriendRequest) => void;
  onBlock: (request: FriendRequest) => void;
};

export default function FriendRequestCard({ request, busy, onAccept, onReject, onBlock }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const rel = relativeDay(request.createdAt);
  const when = rel ? t(rel.key, { count: rel.count }) : formatDate(request.createdAt);
  const name = request.requesterNickName;

  return (
    <View
      testID={`friend-request-${request.requesterIdentifier}`}
      style={[s.plate, { backgroundColor: theme.colors.surface }]}
    >
      <View style={s.head}>
        <UserAvatar name={name} seed={request.requesterIdentifier} size={AVATAR} />
        <View style={s.text}>
          <Text numberOfLines={1} style={[s.name, { color: theme.colors.onSurface }]}>
            {name}
          </Text>
          <Text numberOfLines={1} style={[s.sub, { color: theme.colors.onSurfaceVariant }]}>
            {t("friends.wantsToBeFriends", { when })}
          </Text>
        </View>
        <OverflowMenu
          testID="block-requester-menu"
          size={20}
          style={s.menu}
          accessibilityLabel={t("friends.requestActions", { nickName: name })}
          items={[
            {
              icon: "cancel",
              title: t("friends.block"),
              onPress: () => onBlock(request),
            },
          ]}
        />
      </View>
      <View style={s.answers}>
        <SlimButton
          mode="text"
          compact
          accessibilityLabel={t("friends.reject")}
          onPress={() => onReject(request)}
          disabled={busy}
        >
          {t("friends.rejectShort")}
        </SlimButton>
        <SlimButton
          mode="contained"
          compact
          icon="check"
          style={s.accept}
          accessibilityLabel={t("friends.accept")}
          onPress={() => onAccept(request)}
          disabled={busy}
        >
          {t("friends.acceptShort")}
        </SlimButton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  plate: {
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  menu: {
    margin: 0,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  sub: {
    fontSize: 13,
  },
  answers: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  accept: {
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: 6,
  },
});
