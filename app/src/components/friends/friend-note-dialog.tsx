// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CountedTextInput from "@/components/counted-text-input";
import DialogFrame, { DialogAction } from "@/components/dialog/dialog-frame";
import { FRIEND_NOTE_MAX_LENGTH } from "@/constants/constants";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  visible: boolean;
  nickName: string;
  note: string | null | undefined;
  onDismiss: () => void;
  onSave: (note: string | null) => void;
}

export default function FriendNoteDialog({ visible, nickName, note, onDismiss, onSave }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState(note ?? "");

  useEffect(() => {
    if (visible) setText(note ?? "");
  }, [visible, note]);

  const save = (value: string | null) => {
    onSave(value);
    onDismiss();
  };

  const actions: DialogAction[] = [
    ...(note
      ? [
          {
            label: t("friends.noteRemove"),
            onPress: () => save(null),
            variant: "danger" as const,
            testID: "note-remove",
          },
        ]
      : []),
    { label: t("common.cancel"), onPress: onDismiss, variant: "text", testID: "note-cancel" },
    {
      label: t("friends.noteSave"),
      onPress: () => save(text.trim() || null),
      variant: "primary",
      testID: "note-save",
      disabled: text.trim() === (note ?? ""),
    },
  ];

  return (
    <DialogFrame
      testID="friend-note-dialog"
      visible={visible}
      onDismiss={onDismiss}
      title={t("friends.noteTitle", { name: nickName })}
      icon="note-text-outline"
      actions={actions}
    >
      <Text variant="bodyMedium" style={[s.info, { color: theme.colors.onSurfaceVariant }]}>
        {t("friends.noteInfo")}
      </Text>
      <CountedTextInput
        testID="note-input"
        mode="outlined"
        label={t("friends.noteLabel")}
        value={text}
        onChangeText={setText}
        maxLength={FRIEND_NOTE_MAX_LENGTH}
        autoCapitalize="sentences"
        style={{ backgroundColor: theme.colors.surface }}
      />
    </DialogFrame>
  );
}

const s = StyleSheet.create({
  info: {
    marginBottom: 12,
  },
});
