// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame from "@/components/dialog/dialog-frame";
import { DialogListItem, DialogText } from "@/components/dialog/dialog-section";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface Props {
  visible: boolean;
  onContinue: () => void;
  onDecline: () => void;
}

/**
 * Prominent disclosure shown BEFORE the system location prompt.
 *
 * Google Play requires an in-app disclosure ahead of the runtime permission dialog for
 * background location: what is collected, that it continues in the background, what it is
 * used for, and an affirmative action to proceed. It may not live in the privacy policy —
 * it has to stand in the way. Deliberately not dismissable by tapping outside, so the
 * user makes an explicit choice.
 *
 * Distinct from RecordingInfoDialog on purpose: that one explains how recording behaves
 * (auto-stop, trimming) and can be silenced with "don't show again". This one is consent
 * information and is shown until the permission is granted.
 */
export default function LocationDisclosureDialog({ visible, onContinue, onDecline }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const lines = [
    t("createHike.disclosureBackground"),
    t("createHike.disclosurePrivate"),
    t("createHike.disclosureScope"),
  ];

  return (
    <DialogFrame
      testID="location-disclosure"
      visible={visible}
      dismissable={false}
      onDismiss={onDecline}
      title={t("createHike.disclosureTitle")}
      icon="map-marker-outline"
      actions={[
        { label: t("createHike.disclosureContinue"), onPress: onContinue },
        { label: t("createHike.disclosureDecline"), onPress: onDecline, variant: "text" },
      ]}
    >
      <DialogText>{t("createHike.disclosureIntro")}</DialogText>
      {lines.map((line, index) => (
        <DialogListItem key={index} icon="circle-small" color={theme.colors.primary} text={line} />
      ))}
    </DialogFrame>
  );
}
