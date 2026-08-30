// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Picker } from "@react-native-picker/picker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

// Android must not render a Picker: both of its native components double-free on teardown
// with RN 0.81 + new arch and take the app down with them. It gets plain Pressable rows.
// iOS keeps the wheel — PickerIOS is a different native component and is unaffected.
export default function SelectInput({ selectedValue, onValueChange, options, placeholder }: SelectInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((o) => o.value === selectedValue)?.label ?? placeholder ?? t("common.select");

  return (
    <>
      <Pressable
        style={[s.button, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}
        onPress={() => setOpen(true)}
      >
        <Text style={{ color: theme.colors.onSurface, flex: 1 }}>{selectedLabel}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        {/* edges={["bottom"]}: the sheet is flush to the screen edge, so without the
            inset Android's navigation bar sits on top of the last row. */}
        <SafeAreaView edges={["bottom"]} style={[s.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={[s.header, { borderBottomColor: theme.colors.outline }]}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={{ color: theme.colors.primary, fontSize: 16 }}>{t("common.done")}</Text>
            </Pressable>
          </View>

          {Platform.OS === "ios" ? (
            <Picker selectedValue={selectedValue} onValueChange={(val) => onValueChange(String(val))}>
              {options.map((opt) => (
                <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
              ))}
            </Picker>
          ) : (
            <ScrollView>
              {options.map((opt) => {
                const isSelected = opt.value === selectedValue;
                return (
                  <Pressable
                    key={opt.value}
                    // Picking closes the sheet: unlike the wheel, a tap here is the
                    // final answer, so leaving it open would just need a second tap.
                    onPress={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      s.row,
                      { borderBottomColor: theme.colors.outlineVariant },
                      pressed && { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    <Text style={{ color: isSelected ? theme.colors.primary : theme.colors.onSurface, flex: 1 }}>
                      {opt.label}
                    </Text>
                    {isSelected && <Text style={{ color: theme.colors.primary }}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 4,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    paddingBottom: 20,
    maxHeight: "50%",
  },
  header: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
