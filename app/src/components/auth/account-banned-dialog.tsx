// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import AlertDialog from "../alert-dialog";
import BanContactText from "./ban-contact-text";

interface DialogProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function AccountBannedDialog({ visible, onDismiss }: DialogProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      <AlertDialog
        visible={visible}
        onDismiss={onDismiss}
        title={t("ban.title")}
        infoText={[t("ban.body")]}
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.onSurface}
      >
        <BanContactText style={[s.contact, { color: theme.colors.onSurface }]} linkColor={theme.colors.primary} />
      </AlertDialog>
    </View>
  );
}

const s = StyleSheet.create({
  contact: {
    fontSize: 15,
    lineHeight: 24,
  },
});
