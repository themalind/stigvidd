// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/alert-dialog";
import InfoButton from "@/components/info-button";
import { ComponentProps, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  label: string;
  labelVariant?: ComponentProps<typeof Text>["variant"];
  infoTitle: string;
  infoText: string[];
}

export default function InfoHeading({ label, labelVariant, infoTitle, infoText }: Props) {
  const theme = useTheme();
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View style={s.row}>
      <Text variant={labelVariant}>{label}</Text>
      <InfoButton accessibilityLabel={infoTitle} onPress={() => setShowInfo(true)} />
      <AlertDialog
        visible={showInfo}
        onDismiss={() => setShowInfo(false)}
        title={infoTitle}
        infoText={infoText}
        backgroundColor={theme.colors.background}
        textColor={theme.colors.onBackground}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
