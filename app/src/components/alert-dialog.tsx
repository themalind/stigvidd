// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame, { DialogAction, DialogTone } from "@/components/dialog/dialog-frame";
import DialogSection, { DialogText } from "@/components/dialog/dialog-section";
import React from "react";
import { useTranslation } from "react-i18next";

interface AlertDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  infoText: string[];
  icon?: string;
  tone?: DialogTone;
  irreversible?: boolean;
  warning?: string;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  children?: React.ReactNode;
  testID?: string;
}

export default function AlertDialog({
  visible,
  onDismiss,
  infoText,
  title,
  icon,
  tone = "default",
  irreversible = false,
  warning,
  confirmText,
  onConfirm,
  cancelText,
  children,
  testID = "alert-dialog",
}: AlertDialogProps) {
  const { t } = useTranslation();
  const resolvedCancelText = cancelText ?? t("common.ok");
  const actions: DialogAction[] =
    confirmText && onConfirm
      ? [
          {
            label: confirmText,
            onPress: onConfirm,
            variant: tone === "danger" ? "danger" : "primary",
            testID: `${testID}-confirm`,
          },
          { label: resolvedCancelText, onPress: onDismiss, variant: "text", testID: `${testID}-cancel` },
        ]
      : [{ label: resolvedCancelText, onPress: onDismiss, testID: `${testID}-cancel` }];

  return (
    <DialogFrame
      testID={testID}
      visible={visible}
      onDismiss={onDismiss}
      title={title}
      icon={icon}
      tone={tone}
      actions={actions}
    >
      {infoText.map((line, index) => (
        <DialogText key={index}>{line}</DialogText>
      ))}
      {(irreversible || warning) && (
        <DialogSection testID={`${testID}-warning`} tone="danger" heading={t("common.cannotBeUndone")} text={warning} />
      )}
      {children}
    </DialogFrame>
  );
}
