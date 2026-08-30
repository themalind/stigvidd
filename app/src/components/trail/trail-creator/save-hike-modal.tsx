// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import { ActiveHike } from "@/data/types";
import { StyleSheet } from "react-native";
import { Dialog, Portal, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import SaveHikeForm from "./save-hike-form";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  onSaveSuccess: () => void;
  hike: ActiveHike;
}

export default function SaveHikeModal({ visible, onDismiss, onConfirm, onSaveSuccess, hike }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Portal>
      <Dialog
        style={[s.container, { backgroundColor: theme.colors.background }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <Dialog.Title>{t("hike.saveTitle")}</Dialog.Title>
        <Dialog.Content>
          <SaveHikeForm hike={hike} onDismiss={onDismiss} onSaveSuccess={onSaveSuccess} />
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: DIALOG_BORDER_RADIUS,
  },
});
