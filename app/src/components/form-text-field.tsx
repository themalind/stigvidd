// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CountedTextInput from "@/components/counted-text-input";
import { BORDER_RADIUS } from "@/constants/constants";
import { asTranslationKey } from "@/i18n";
import { Control, Controller, FieldError, FieldPathByValue, FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props<T extends FieldValues> {
  name: FieldPathByValue<T, string>;
  control: Control<T>;
  label: string;
  maxLength: number;
  testID: string;
  error?: FieldError;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function FormTextField<T extends FieldValues>({
  name,
  control,
  label,
  maxLength,
  testID,
  error,
  multiline,
  style,
}: Props<T>) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[s.field, style]}>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <CountedTextInput
            testID={testID}
            error={!!error}
            style={[s.textInput, { backgroundColor: theme.colors.surfaceVariant }]}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            label={label}
            maxLength={maxLength}
            autoCapitalize="sentences"
            textAlignVertical="top"
            multiline={multiline}
            theme={{ colors: { onSurfaceVariant: theme.colors.primary } }}
          />
        )}
      />
      {error?.message && (
        <Text
          testID={`${testID}-error`}
          style={[s.errorBadge, { color: theme.colors.onErrorContainer, backgroundColor: theme.colors.errorContainer }]}
        >
          {t(asTranslationKey(error.message))}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    gap: 4,
  },
  textInput: {
    width: "100%",
  },
  errorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
});
