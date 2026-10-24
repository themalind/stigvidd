// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogSection from "@/components/dialog/dialog-section";
import InfoDialog from "@/components/dialog/info-dialog";
import { DIFFICULTIES } from "@/data/trail-content";
import { asTranslationKey } from "@/i18n";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { useTranslation } from "react-i18next";

interface Props {
  difficulty?: number;
  visible: boolean;
  onDismiss: () => void;
}

export default function DifficultyInfoModal({ difficulty, visible, onDismiss }: Props) {
  const { t } = useTranslation();

  return (
    <InfoDialog
      testID="difficulty-info"
      visible={visible}
      onDismiss={onDismiss}
      title={t("trail.difficultiesTitle")}
      icon="terrain"
    >
      {DIFFICULTIES.map((item) => {
        const selected = difficulty === item.value;
        return (
          <DialogSection
            key={item.value}
            testID="difficulty-info-card"
            selected={selected}
            badge={selected ? t("trail.thisTrail") : undefined}
            icon={getDifficultyIcon(classificationParser(item.value))}
            heading={t(asTranslationKey(item.label))}
            text={t(asTranslationKey(item.description))}
          />
        );
      })}
    </InfoDialog>
  );
}
