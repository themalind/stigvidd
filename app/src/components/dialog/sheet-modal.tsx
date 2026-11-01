// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ModalScrim from "@/components/dialog/modal-scrim";
import { BORDER_RADIUS } from "@/constants/constants";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";

const HEIGHT = Dimensions.get("screen").height;

type Props = {
  visible: boolean;
  onDismiss: () => void;
  icon: string;
  title: string;
  testID?: string;
  children: ReactNode;
};

// A tall modal with an icon title and a close button; children fill the rest, so a FlatList can scroll. keep-comment: why not DialogFrame, which wraps children in a ScrollView
export default function SheetModal({ visible, onDismiss, icon, title, testID, children }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Portal>
      {visible && <ModalScrim />}
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={s.container}>
        <View testID={testID} style={[s.inner, { backgroundColor: theme.colors.surface }]}>
          <View style={s.header}>
            <Icon source={icon} size={18} color={theme.colors.primary} />
            <Text variant="titleMedium" style={[s.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <Pressable hitSlop={12} onPress={onDismiss} accessibilityLabel={t("common.close")}>
              <Icon size={24} source="close" color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <Divider />
          {children}
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: BORDER_RADIUS,
  },
  inner: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    height: HEIGHT * 0.75,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
  },
  title: {
    flex: 1,
  },
});
