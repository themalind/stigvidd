// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame from "@/components/dialog/dialog-frame";
import PersonRow from "@/components/friends/person-row";
import { ShareRecipient } from "@/data/types";
import { formatDate } from "@/utils/format-date";
import { useTranslation } from "react-i18next";

interface Props {
  visible: boolean;
  recipients: readonly ShareRecipient[];
  onDismiss: () => void;
  onShareMore?: () => void;
}

export default function ShareRecipientsDialog({ visible, recipients, onDismiss, onShareMore }: Props) {
  const { t } = useTranslation();

  return (
    <DialogFrame
      testID="share-recipients-dialog"
      visible={visible}
      onDismiss={onDismiss}
      title={t("hike.sharedWithCount", { count: recipients.length })}
      icon="account-multiple-outline"
      showClose
      actions={
        onShareMore
          ? [
              {
                label: t("hike.shareWithMore"),
                variant: "primary",
                testID: "share-more",
                onPress: () => {
                  onDismiss();
                  onShareMore();
                },
              },
            ]
          : []
      }
    >
      {recipients.map((r) => (
        <PersonRow
          key={r.identifier}
          testID="share-recipient"
          name={r.nickName}
          identifier={r.identifier}
          subtitle={t("hike.sharedOnDate", { date: formatDate(r.sharedAt) })}
        />
      ))}
    </DialogFrame>
  );
}
