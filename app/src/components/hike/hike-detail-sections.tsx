// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { InfoCard, InfoGrid, InfoItem, InfoLabel, InfoValue } from "@/components/info-card";
import { BORDER_RADIUS } from "@/constants/constants";
import FormattedTime from "@/utils/format-time-from-ms";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Divider, Icon, Text, useTheme } from "react-native-paper";

export function HikeStatsCard({ hikeLength, duration }: { hikeLength: number; duration: number }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View testID="hike-stats" style={[s.statsCard, { backgroundColor: theme.colors.outlineVariant }]}>
      <View style={s.statItem}>
        <Text style={s.statLabel}>{t("hike.length")}</Text>
        <Text style={s.statValue}>{hikeLength} km</Text>
      </View>
      <Divider style={[s.statDivider, { backgroundColor: theme.colors.outline }]} />
      <View style={s.statItem}>
        <Text style={s.statLabel}>{t("hike.time")}</Text>
        <Text style={s.statValue}>{FormattedTime(duration)}</Text>
      </View>
    </View>
  );
}

export interface HikeInfo {
  gettingThere?: string | null;
  parkingInfo?: string | null;
  description?: string | null;
}

const hasInfo = ({ gettingThere, parkingInfo, description }: HikeInfo) =>
  Boolean(gettingThere || parkingInfo || description);

function InfoRowList({ gettingThere, parkingInfo, description }: HikeInfo) {
  const { t } = useTranslation();

  return (
    <>
      {gettingThere && <InfoRow icon="map-marker" label={t("hike.gettingThere")} text={gettingThere} />}
      {parkingInfo && <InfoRow icon="car" label={t("hike.parking")} text={parkingInfo} />}
      {description && <InfoRow icon="text" label={t("hike.description")} text={description} />}
    </>
  );
}

export function HikeInfoRows(info: HikeInfo) {
  if (!hasInfo(info)) return null;

  return (
    <View style={s.info}>
      <Divider />
      <InfoRowList {...info} />
    </View>
  );
}

export function HikeInfoCard(info: HikeInfo) {
  const { t } = useTranslation();

  if (!hasInfo(info)) return null;

  return (
    <InfoCard testID="hike-info-card" title={t("hike.goodToKnow")}>
      <InfoRowList {...info} />
    </InfoCard>
  );
}

export interface HikeFact {
  label: string;
  value: string;
}

export function HikeFactsCard({ facts }: { facts: HikeFact[] }) {
  const { t } = useTranslation();

  return (
    <InfoCard testID="hike-facts" title={t("trail.info")}>
      <InfoGrid>
        {facts.map(({ label, value }) => (
          <InfoItem key={label} label={label} value={value} />
        ))}
      </InfoGrid>
    </InfoCard>
  );
}

function InfoRow({ icon, label, text }: { icon: string; label: string; text: string }) {
  const theme = useTheme();

  return (
    <View style={s.infoRow}>
      <Icon source={icon} size={18} color={theme.colors.primary} />
      <View style={s.infoText}>
        <InfoLabel color={theme.colors.secondary}>{label}</InfoLabel>
        <InfoValue>{text}</InfoValue>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  statsCard: {
    flexDirection: "row",
    borderRadius: BORDER_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  statValue: {
    fontSize: 18,
  },
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  info: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
});
