// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import InfoButton from "@/components/info-button";
import { InfoCard, InfoGrid, InfoItem, InfoValue } from "@/components/info-card";
import { Trail } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import AccesibilityInfoModal from "./accessibility-info-modal";
import DifficultyInfoModal from "./difficulty-info-modal";
import SymbolInfoModal from "./symbol-info-modal";

interface TrailinfoProps {
  trail: Trail;
}

export default function TrailInfo({ trail }: TrailinfoProps) {
  const { t } = useTranslation();
  const [difficultyModal, setDifficultyModal] = useState(false);
  const [accessibiltyModal, setAccessibilityModal] = useState(false);
  const [symbolModal, setSymbolModal] = useState(false);
  // The API sends "" for a trail without a symbol image, never null. keep-comment: API contract not visible here
  const hasSymbolImage = Boolean(trail.trailSymbolImage);

  const helpButton = (testID: string, label: string, onPress: () => void) => (
    <InfoButton testID={testID} accessibilityLabel={label} onPress={onPress} />
  );

  return (
    <InfoCard testID="trail-info" title={t("trail.info")}>
      <InfoGrid>
        <InfoItem
          label={t("trail.marking")}
          labelAccessory={
            hasSymbolImage && helpButton("trail-info-symbol-help", t("trail.markingTitle"), () => setSymbolModal(true))
          }
          value={trail.trailSymbol?.trim() || t("trail.unmarked")}
        />
        <InfoItem label={t("trail.length")} value={`${trail.trailLength} km`} />
        <InfoItem
          label={t("trail.difficulty")}
          labelAccessory={helpButton("trail-info-difficulty-help", t("trail.difficultiesTitle"), () =>
            setDifficultyModal(true),
          )}
        >
          <View style={s.iconRow}>
            {getDifficultyIcon(classificationParser(trail.classification))}
            <InfoValue>{classificationParser(trail.classification)}</InfoValue>
          </View>
        </InfoItem>
        <InfoItem
          label={t("trail.accessibility")}
          labelAccessory={helpButton("trail-info-accessibility-help", t("trail.accessibilityTitle"), () =>
            setAccessibilityModal(true),
          )}
          value={trail.accessibility ? t("trail.adapted") : t("trail.notAdapted")}
        />
        {!!trail.accessibilityInfo?.trim() && (
          <InfoItem label={t("trail.variation")} value={trail.accessibilityInfo} fullWidth />
        )}
      </InfoGrid>
      {hasSymbolImage && (
        <SymbolInfoModal
          imageUrl={trail.trailSymbolImage}
          symbol={trail.trailSymbol}
          onDismiss={() => setSymbolModal(false)}
          visible={symbolModal}
        />
      )}
      <DifficultyInfoModal
        difficulty={trail.classification}
        onDismiss={() => setDifficultyModal(false)}
        visible={difficultyModal}
      />
      <AccesibilityInfoModal onDismiss={() => setAccessibilityModal(false)} visible={accessibiltyModal} />
    </InfoCard>
  );
}

const s = StyleSheet.create({
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
