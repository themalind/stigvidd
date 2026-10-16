// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Icon, List, Text, useTheme } from "react-native-paper";

interface Props {
  isPending: boolean;
  onPublish: () => void;
}

// keep-comment: collapsed by default and the form is a second step, so publishing takes a deliberate choice
export default function PublishHikeCard({ isPending, onPublish }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (isPending) {
    return (
      <View
        testID="publish-hike-pending"
        style={[s.card, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}
      >
        <Icon source="clock-outline" size={20} color={theme.colors.onSurfaceVariant} />
        <Text style={[s.pendingText, { color: theme.colors.onSurfaceVariant }]}>{t("publish.pendingHint")}</Text>
      </View>
    );
  }

  const points = [t("publish.pointReview"), t("publish.pointOwnership"), t("publish.pointTrim")];

  return (
    <View style={[s.section, { borderColor: theme.colors.outlineVariant }]}>
      <List.Accordion
        testID="publish-hike-accordion"
        title={t("publish.sectionTitle")}
        titleStyle={{ color: theme.colors.onSurface }}
        left={(props) => <List.Icon {...props} icon="upload" color={theme.colors.onSurfaceVariant} />}
        right={(props) => (
          <List.Icon
            {...props}
            icon={props.isExpanded ? "chevron-up" : "chevron-down"}
            color={theme.colors.onSurfaceVariant}
          />
        )}
        expanded={expanded}
        onPress={() => setExpanded((v) => !v)}
        style={[s.accordion, { backgroundColor: theme.colors.surface }]}
      >
        <View style={s.content}>
          <Text variant="bodyMedium">{t("publish.sectionIntro")}</Text>
          {points.map((point) => (
            <View key={point} style={s.point}>
              <Icon source="circle-small" size={20} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodySmall" style={[s.pointText, { color: theme.colors.onSurfaceVariant }]}>
                {point}
              </Text>
            </View>
          ))}
          <Button testID="hike-publish" style={s.button} mode="outlined" onPress={onPublish}>
            {t("publish.button")}
          </Button>
        </View>
      </List.Accordion>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  accordion: {
    paddingVertical: 0,
  },
  content: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  point: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pointText: {
    flex: 1,
  },
  button: {
    marginTop: 4,
    borderRadius: BORDER_RADIUS,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
  },
  pendingText: {
    flex: 1,
  },
});
