// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, useTheme } from "react-native-paper";

type Props = Omit<ComponentProps<typeof TextInput>, "mode" | "left" | "right" | "value" | "onChangeText"> & {
  value: string;
  onChangeText: (text: string) => void;
  // Runs instead of clearing the text when given. keep-comment: a collapsing search closes itself here
  onClear?: () => void;
  clearable?: boolean;
  clearTestID?: string;
};

export default function SearchField({
  value,
  onChangeText,
  onClear,
  clearable = true,
  clearTestID = "search-close-icon",
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const showClear = clearable && (value.length > 0 || onClear !== undefined);

  return (
    <TextInput
      {...rest}
      mode="outlined"
      value={value}
      onChangeText={onChangeText}
      left={<TextInput.Icon icon="magnify" />}
      right={
        showClear ? (
          <TextInput.Icon
            testID={clearTestID}
            icon="close"
            accessibilityLabel={t("filter.clearSearch")}
            onPress={onClear ?? (() => onChangeText(""))}
          />
        ) : undefined
      }
      style={[{ backgroundColor: theme.colors.surface }, style]}
      theme={{ colors: { primary: theme.colors.outlineVariant } }}
    />
  );
}
