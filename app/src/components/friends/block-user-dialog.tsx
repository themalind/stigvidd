// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/alert-dialog";
import { useTranslation } from "react-i18next";

export interface UserRef {
  identifier: string;
  nickName: string;
}

interface Props {
  user: UserRef | null;
  onDismiss: () => void;
  onConfirm: (user: UserRef) => void;
}

export default function BlockUserDialog({ user, onDismiss, onConfirm }: Props) {
  const { t } = useTranslation();

  return (
    <AlertDialog
      visible={user !== null}
      onDismiss={onDismiss}
      onConfirm={() => {
        if (user) onConfirm(user);
        onDismiss();
      }}
      title={t("friends.blockTitle", { name: user?.nickName ?? "" })}
      infoText={[t("friends.blockInfo"), t("friends.blockContinue")]}
      cancelText={t("common.cancel")}
      confirmText={t("friends.block")}
      icon="cancel"
      tone="danger"
    />
  );
}
