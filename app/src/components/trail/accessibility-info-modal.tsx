// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogSection from "@/components/dialog/dialog-section";
import InfoDialog from "@/components/dialog/info-dialog";
import { ACCESSIBILITY_INFO } from "@/data/trail-content";
import { asTranslationKey } from "@/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function AccesibilityInfoModal({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <InfoDialog
      testID="accessibility-info"
      visible={visible}
      onDismiss={onDismiss}
      title={t("trail.accessibilityTitle")}
      icon="human-handsup"
    >
      {ACCESSIBILITY_INFO.map((info) => {
        const paragraphs = t(asTranslationKey(info.description))
          .split("\n")
          .filter((p) => p.trim().length > 0);

        return (
          <DialogSection
            key={info.title}
            testID="accessibility-info-card"
            icon={<MaterialCommunityIcons name={info.iconName} size={20} color={theme.colors.primary} />}
            heading={t(asTranslationKey(info.title))}
          >
            {paragraphs.map((paragraph, i) => (
              <Text key={i} style={[s.paragraph, { color: theme.colors.onSurface }, i > 0 && s.spacing]}>
                {paragraph.trim()}
              </Text>
            ))}
          </DialogSection>
        );
      })}
    </InfoDialog>
  );
}

const s = StyleSheet.create({
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
  },
  spacing: {
    marginTop: 8,
  },
});
