// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { DialogText } from "@/components/dialog/dialog-section";
import InfoDialog from "@/components/dialog/info-dialog";
import InfoButton from "@/components/info-button";
import { ComponentProps, ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

interface Props {
  label: string;
  labelVariant?: ComponentProps<typeof Text>["variant"];
  infoTitle: string;
  infoIcon?: string;
  infoIntro?: string;
  infoText?: string[];
  children?: ReactNode;
}

export default function InfoHeading({
  label,
  labelVariant,
  infoTitle,
  infoIcon,
  infoIntro,
  infoText,
  children,
}: Props) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View style={s.row}>
      <Text variant={labelVariant}>{label}</Text>
      <InfoButton accessibilityLabel={infoTitle} onPress={() => setShowInfo(true)} />
      <InfoDialog
        visible={showInfo}
        onDismiss={() => setShowInfo(false)}
        title={infoTitle}
        icon={infoIcon}
        intro={infoIntro}
      >
        {infoText?.map((line, index) => (
          <DialogText key={index}>{line}</DialogText>
        ))}
        {children}
      </InfoDialog>
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
