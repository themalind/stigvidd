// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { DialogText } from "@/components/dialog/dialog-section";
import InfoDialog from "@/components/dialog/info-dialog";
import ExampleImageOverlay from "@/components/example-image-overlay";
import { BORDER_RADIUS } from "@/constants/constants";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Dimensions, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  imageUrl: string;
  symbol: string;
  visible: boolean;
  onDismiss: () => void;
}

const { height, width } = Dimensions.get("screen");

export default function SymbolInfoModal({ imageUrl, symbol, visible, onDismiss }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <InfoDialog
      testID="symbol-info"
      visible={visible}
      onDismiss={onDismiss}
      title={t("trail.markingTitle")}
      icon="sign-direction"
    >
      <View
        testID="symbol-info-image-frame"
        style={[s.imageFrame, { backgroundColor: theme.colors.secondaryContainer }]}
      >
        <Image testID="symbol-info-image" source={imageUrl} contentFit="contain" style={s.image} />
        <ExampleImageOverlay source={imageUrl} />
      </View>

      {symbol.length > 0 && (
        <Text testID="symbol-info-caption" style={[s.caption, { color: theme.colors.onSurface }]}>
          {symbol}
        </Text>
      )}

      <DialogText>{t("trail.markingInfo")}</DialogText>
    </InfoDialog>
  );
}

const s = StyleSheet.create({
  imageFrame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  image: {
    height: height * 0.3,
    width: width * 0.55,
  },
  caption: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
});
