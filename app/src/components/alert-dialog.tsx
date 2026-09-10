// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import React from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button, Dialog, Portal, useTheme } from "react-native-paper";

interface AlertDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  infoText: string[];
  backgroundColor: string;
  textColor?: string;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
}

export default function AlertDialog({
  visible,
  onDismiss,
  infoText,
  title,
  backgroundColor,
  textColor,
  confirmText,
  onConfirm,
  cancelText,
}: AlertDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const resolvedCancelText = cancelText ?? t("common.ok");
  const resolvedTextColor = textColor ?? theme.colors.onSurface;
  return (
    <Portal>
      <Dialog
        testID="alert-dialog"
        style={{ backgroundColor: backgroundColor, borderRadius: DIALOG_BORDER_RADIUS }}
        visible={visible}
        onDismiss={onDismiss}
      >
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <View style={{ gap: 10 }}>
            {infoText.map((t, index) => (
              <Text key={index} style={{ fontSize: 15, lineHeight: 24, color: resolvedTextColor }}>
                {infoText[index]}
              </Text>
            ))}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>
            <Text style={{ fontSize: 18, color: resolvedTextColor }}>{resolvedCancelText}</Text>
          </Button>
          {confirmText && onConfirm && (
            <Button onPress={onConfirm}>
              <Text style={{ fontSize: 18, color: resolvedTextColor }}>{confirmText}</Text>
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
