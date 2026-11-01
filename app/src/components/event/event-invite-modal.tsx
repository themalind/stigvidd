// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SheetModal from "@/components/dialog/sheet-modal";
import UserPicker from "@/components/user/user-picker";
import { EVENT_REQUEST_LIMITS } from "@/constants/event-limits";
import { useTranslation } from "react-i18next";

const MAX_EVENT_INVITES = EVENT_REQUEST_LIMITS.invitesPerRequest;

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onInvite: (nickNames: string[]) => void;
  isPending?: boolean;
  excludeNickNames?: string[];
  dropNickNames?: string[];
  initialSelected?: string[];
}

export default function EventInviteModal({
  visible,
  onDismiss,
  onInvite,
  isPending,
  excludeNickNames,
  dropNickNames,
  initialSelected,
}: Props) {
  const { t } = useTranslation();

  return (
    <SheetModal
      visible={visible}
      onDismiss={onDismiss}
      icon="account-plus-outline"
      title={t("events.invite")}
      testID="event-invite-modal"
    >
      <UserPicker
        enabled={visible}
        searchable
        onSubmit={onInvite}
        isPending={isPending}
        excludeNickNames={excludeNickNames}
        dropNickNames={dropNickNames}
        initialSelected={initialSelected}
        limit={MAX_EVENT_INVITES}
        submitIcon="account-plus-outline"
        submitLabel={(count) => (count === 0 ? t("events.chooseInvitees") : t("events.inviteCount", { count }))}
        emptyText={t("events.noFriendsToInvite")}
        limitText={t("events.inviteLimitReached", { max: MAX_EVENT_INVITES })}
      />
    </SheetModal>
  );
}
