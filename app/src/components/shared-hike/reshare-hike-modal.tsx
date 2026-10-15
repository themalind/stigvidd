// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FriendPicker from "@/components/shared-hike/friend-picker";
import { BORDER_RADIUS } from "@/constants/constants";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";

const HEIGHT = Dimensions.get("screen").height;

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onShare: (friendNickNames: string[]) => void;
  isPending?: boolean;
  excludeNickNames?: string[];
}

export default function ReshareHikeModal({ visible, onDismiss, onShare, isPending, excludeNickNames }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={s.container}>
        <View style={[s.inner, { backgroundColor: theme.colors.surface }]}>
          <View style={s.header}>
            <Icon source="share" size={18} color={theme.colors.primary} />
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {t("hike.shareWithFriend")}
            </Text>
            <Pressable hitSlop={12} onPress={onDismiss}>
              <Icon size={24} source="close" color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <Divider />
          <FriendPicker enabled={visible} onShare={onShare} isPending={isPending} excludeNickNames={excludeNickNames} />
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
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
});
