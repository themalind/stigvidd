// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import AlertDialog from "../alert-dialog";

interface DialogProps {
  infoMessage: string;
  visible: boolean;
  onDissmiss: () => void;
  onBeforeNavigate?: () => void;
}

export default function NotAuthenticatedDialog({ infoMessage, visible, onDissmiss, onBeforeNavigate }: DialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      testID="not-authenticated-dialog"
      visible={visible}
      onDismiss={() => onDissmiss()}
      title={t("auth.notLoggedIn")}
      icon="lock-outline"
      infoText={[infoMessage]}
      confirmText={t("auth.goToLogin")}
      cancelText={t("common.cancel")}
      onConfirm={() => {
        onDissmiss();
        onBeforeNavigate?.();
        router.navigate("/(tabs)/(profile-stack)/login");
      }}
    />
  );
}
