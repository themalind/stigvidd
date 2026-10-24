// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame, { DialogAction } from "@/components/dialog/dialog-frame";
import { DialogText } from "@/components/dialog/dialog-section";
import { INACTIVITY_TIMEOUT, MAX_DURATION } from "@/services/location-task";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Checkbox, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  // When provided, the dialog is shown before recording starts: it offers a
  // "don't show again" checkbox and a Start button (the boolean reports the
  // checkbox state). When omitted, the dialog is purely informational (OK only).
  onStart?: (dontShowAgain: boolean) => void;
}

const INACTIVITY_MINUTES = Math.round(INACTIVITY_TIMEOUT / 60_000);
const MAX_HOURS = Math.round(MAX_DURATION / 3_600_000);

export default function RecordingInfoDialog({ visible, onDismiss, onStart }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const lines = [
    t("createHike.infoIntro"),
    t("createHike.infoInactivity", { minutes: INACTIVITY_MINUTES }),
    t("createHike.infoMaxDuration", { hours: MAX_HOURS }),
    t("createHike.infoTrimHint"),
  ];

  const actions: DialogAction[] = onStart
    ? [
        { label: t("createHike.start"), onPress: () => onStart(dontShowAgain) },
        { label: t("common.cancel"), onPress: onDismiss, variant: "text" },
      ]
    : [{ label: t("common.ok"), onPress: onDismiss }];

  return (
    <DialogFrame
      testID="recording-info"
      visible={visible}
      onDismiss={onDismiss}
      title={t("createHike.infoTitle")}
      icon="record-circle-outline"
      showClose={!onStart}
      actions={actions}
    >
      {lines.map((line, index) => (
        <DialogText key={index}>{line}</DialogText>
      ))}
      {onStart && (
        <Pressable style={s.checkboxRow} onPress={() => setDontShowAgain((prev) => !prev)}>
          <Checkbox.Android
            status={dontShowAgain ? "checked" : "unchecked"}
            color={theme.colors.primary}
            uncheckedColor={theme.colors.onSurfaceVariant}
          />
          <Text variant="bodyMedium">{t("createHike.dontShowAgain")}</Text>
        </Pressable>
      )}
    </DialogFrame>
  );
}

const s = StyleSheet.create({
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 8,
  },
});
