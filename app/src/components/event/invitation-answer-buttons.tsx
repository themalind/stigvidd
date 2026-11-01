// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";

type Props = {
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export default function InvitationAnswerButtons({ busy, onAccept, onDecline }: Props) {
  const { t } = useTranslation();

  return (
    <View style={s.actions}>
      <Button mode="text" disabled={busy} onPress={onDecline}>
        {t("events.decline")}
      </Button>
      <Button mode="contained" disabled={busy} onPress={onAccept} style={s.accept}>
        {t("events.accept")}
      </Button>
    </View>
  );
}

const s = StyleSheet.create({
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  accept: {
    borderRadius: BORDER_RADIUS,
  },
});
