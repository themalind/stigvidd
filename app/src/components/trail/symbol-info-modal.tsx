// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ExampleImageOverlay from "@/components/example-image-overlay";
import { BORDER_RADIUS } from "@/constants/constants";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Icon, Modal, Portal, Text, useTheme } from "react-native-paper";

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
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <View testID="symbol-info-content" style={s.content}>
          <View testID="symbol-info-header" style={s.header}>
            <View testID="symbol-info-header-left" style={s.headerLeft}>
              <View testID="symbol-info-symbol" style={[s.headerIconCircle, { borderColor: theme.colors.primary }]}>
                <Icon size={20} source="sign-direction" color={theme.colors.tertiary} />
              </View>
              <Text style={s.title}>{t("trail.markingTitle")}</Text>
            </View>
            <Pressable testID="symbol-info-close" hitSlop={16} onPress={onDismiss}>
              <Icon source="close" size={20} color={theme.colors.onSurface} />
            </Pressable>
          </View>

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

          <Text testID="symbol-info-body" style={s.body}>
            {t("trail.markingInfo")}
          </Text>
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  // Wraps its content rather than filling the screen.
  modalContainerStyle: {
    margin: 20,
    maxHeight: height * 0.8,
    borderRadius: BORDER_RADIUS,
    padding: 10,
  },
  content: {
    gap: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 5,
  },
  headerLeft: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  headerIconCircle: {
    borderWidth: 0.5,
    borderRadius: 100,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "700",
    fontSize: 16,
  },
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
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 5,
    paddingBottom: 5,
  },
});
