// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type SheetProps = {
  visible: boolean;
  title: string;
  onClear: () => void;
  onClose: () => void;
  children: ReactNode;
};

export default function FilterSheet({ visible, title, onClear, onClose, children }: SheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[s.container, { backgroundColor: theme.colors.background }]}>
        <View style={s.header}>
          <Pressable
            testID="filter-sheet-clear"
            accessibilityRole="button"
            style={[s.clearWrapper, { backgroundColor: theme.colors.secondary }]}
            onPress={onClear}
          >
            <Text style={[s.headerButton, { color: theme.colors.onSecondary }]}>{t("filter.clear")}</Text>
          </Pressable>
          <Text style={s.title}>{title}</Text>
          <Pressable
            testID="filter-sheet-done"
            accessibilityRole="button"
            style={[s.doneWrapper, { backgroundColor: theme.colors.primary }]}
            onPress={onClose}
          >
            <Text style={[s.headerButton, { color: theme.colors.onPrimary }]}>{t("filter.done")}</Text>
          </Pressable>
        </View>
        <Divider />
        <ScrollView style={s.content}>{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

type SectionProps = {
  // Left out when the content titles itself, as a slider showing its value does. keep-comment: when title is optional
  title?: string;
  children: ReactNode;
};

export function FilterSection({ title, children }: SectionProps) {
  return (
    <>
      <View style={s.section}>
        {title ? <Text style={s.sectionTitle}>{title}</Text> : null}
        {children}
      </View>
      <Divider />
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  clearWrapper: {
    borderRadius: BORDER_RADIUS,
  },
  doneWrapper: {
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS,
  },
  headerButton: {
    padding: 5,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 10,
  },
});

export const filterSectionTitleStyle = s.sectionTitle;
