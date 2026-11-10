// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogSection from "@/components/dialog/dialog-section";
import InfoDialog from "@/components/dialog/info-dialog";
import InfoButton from "@/components/display/info-button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ComponentProps, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const SECTIONS: { key: "sharedBy" | "ownAssessment" | "unmarked" | "ownRisk"; icon: IconName }[] = [
  { key: "sharedBy", icon: "account-group-outline" },
  { key: "ownAssessment", icon: "clipboard-text-outline" },
  { key: "unmarked", icon: "map-marker-question-outline" },
  { key: "ownRisk", icon: "shield-account-outline" },
];

interface Props {
  testID?: string;
}

export default function ContributionInfo({ testID = "contribution-info" }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <InfoButton
        testID={`${testID}-button`}
        accessibilityLabel={t("trail.contributionInfo.title")}
        onPress={() => setVisible(true)}
      />
      <InfoDialog
        testID={testID}
        visible={visible}
        onDismiss={() => setVisible(false)}
        title={t("trail.contributionInfo.title")}
        icon="account-group-outline"
      >
        {SECTIONS.map(({ key, icon }) => (
          <DialogSection
            key={key}
            testID={`${testID}-card`}
            icon={<MaterialCommunityIcons name={icon} size={20} color={theme.colors.primary} />}
            heading={t(`trail.contributionInfo.${key}.heading`)}
            text={t(`trail.contributionInfo.${key}.text`)}
          />
        ))}
      </InfoDialog>
    </>
  );
}
