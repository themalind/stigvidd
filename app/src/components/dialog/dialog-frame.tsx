// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS, DIALOG_BORDER_RADIUS } from "@/constants/constants";
import ModalScrim from "@/components/dialog/modal-scrim";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";

export type DialogTone = "default" | "danger";

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "text";
  testID?: string;
  disabled?: boolean;
  loading?: boolean;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  icon?: string;
  tone?: DialogTone;
  showClose?: boolean;
  dismissable?: boolean;
  actions: DialogAction[];
  children?: ReactNode;
  testID?: string;
}

export default function DialogFrame({
  visible,
  onDismiss,
  title,
  icon,
  tone = "default",
  showClose = false,
  dismissable = true,
  actions,
  children,
  testID = "dialog",
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const accent = tone === "danger" ? theme.colors.error : theme.colors.primary;

  return (
    <Portal>
      {visible && <ModalScrim />}
      <Modal
        testID={testID}
        visible={visible}
        onDismiss={onDismiss}
        dismissable={dismissable}
        contentContainerStyle={[s.card, { backgroundColor: theme.colors.surface }]}
      >
        <View style={[s.inner, { maxHeight: height * 0.85 }]}>
          <View testID={`${testID}-header`} style={s.header}>
            <View style={s.headerLeft}>
              {icon && <Icon source={icon} size={18} color={accent} />}
              <Text style={[s.title, { color: theme.colors.onSurface }]}>{title}</Text>
            </View>
            {showClose && (
              <Pressable
                testID={`${testID}-close`}
                hitSlop={12}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <Icon source="close" size={24} color={theme.colors.onSurface} />
              </Pressable>
            )}
          </View>

          {children && (
            <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          )}

          {actions.length > 0 && (
            <View style={s.actions}>
              {actions.map((action) => (
                <DialogButton key={action.label} action={action} />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </Portal>
  );
}

function DialogButton({ action }: { action: DialogAction }) {
  const theme = useTheme();
  const variant = action.variant ?? "primary";

  return (
    <Button
      testID={action.testID}
      mode={variant === "text" ? "text" : "contained"}
      onPress={action.onPress}
      disabled={action.disabled}
      loading={action.loading}
      buttonColor={variant === "danger" ? theme.colors.error : undefined}
      textColor={variant === "danger" ? theme.colors.onError : undefined}
      style={s.button}
    >
      {action.label}
    </Button>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: DIALOG_BORDER_RADIUS,
  },
  inner: {
    padding: 15,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    gap: 10,
  },
  actions: {
    gap: 4,
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
