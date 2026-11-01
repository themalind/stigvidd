// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import UserPicker from "@/components/user/user-picker";
import { MAX_SHARE_RECIPIENTS } from "@/constants/constants";
import { useTranslation } from "react-i18next";

interface Props {
  enabled: boolean;
  onShare: (friendNickNames: string[]) => void;
  isPending?: boolean;
  excludeNickNames?: string[];
  initialSelected?: string[];
}

export default function FriendPicker({ enabled, onShare, isPending, excludeNickNames, initialSelected }: Props) {
  const { t } = useTranslation();

  return (
    <UserPicker
      enabled={enabled}
      onSubmit={onShare}
      isPending={isPending}
      excludeNickNames={excludeNickNames}
      initialSelected={initialSelected}
      submitIcon="share"
      submitLabel={(count) => (count === 0 ? t("hike.selectFriends") : t("hike.shareWithCount", { count }))}
      emptyText={t("hike.noFriendsToShare")}
      limitText={t("hike.shareLimitReached", { max: MAX_SHARE_RECIPIENTS })}
    />
  );
}
