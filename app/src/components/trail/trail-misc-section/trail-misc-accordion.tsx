// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Trail } from "@/data/types";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Divider, Icon, List, Surface, Text, useTheme } from "react-native-paper";
import FullDescriptionSection from "./full-description-section";
import LinkSection from "./link-section";
import VisitorInformationSection from "./visitor-information-section";

interface Props {
  trail: Trail;
  onOpenGuide: () => void;
}
export default function TrailMiscInfo({ trail, onOpenGuide }: Props) {
  const [expandedId, setExpandedId] = useState<string | number>("1");
  const theme = useTheme();
  const { t } = useTranslation();
  const visitorInfo = trail.visitorInformation;
  // Ett tomt VisitorInformation-objekt är fortfarande truthy — kolla innehållet.
  const hasVisitorInfo = Boolean(
    visitorInfo &&
      (visitorInfo.gettingThere ||
        visitorInfo.publicTransport ||
        visitorInfo.parking ||
        visitorInfo.maintainedBy ||
        (visitorInfo.illumination && visitorInfo.illuminationText)),
  );
  const sections: { id: string; title: string; content: React.ReactNode }[] = [];
  if (visitorInfo && hasVisitorInfo) {
    sections.push({
      id: "1",
      title: t("trail.practicalInfo"),
      content: <VisitorInformationSection visitorInfo={visitorInfo} />,
    });
  }
  if (trail.fullDescription) {
    sections.push({
      id: "2",
      title: t("trail.detailedDescription"),
      content: <FullDescriptionSection fullDescription={trail.fullDescription} />,
    });
  }
  if (trail.trailLinksResponse?.length) {
    sections.push({ id: "3", title: t("trail.links"), content: <LinkSection links={trail.trailLinksResponse} /> });
  }

  return (
    <Surface testID="trail-misc" elevation={0} style={[s.container, { backgroundColor: theme.colors.surface }]}>
      <List.AccordionGroup
        expandedId={expandedId}
        onAccordionPress={(id) => setExpandedId((prev) => (prev === id ? "" : id))}
      >
        {sections.map((section, index) => (
          <React.Fragment key={section.id}>
            {index > 0 && <Divider testID="trail-misc-divider" />}
            <List.Accordion
              titleStyle={[s.titleText, { color: theme.colors.onSurface }]}
              contentStyle={s.accordionContent}
              title={section.title}
              id={section.id}
              style={{ backgroundColor: theme.colors.surface }}
              right={(props) => (
                <List.Icon
                  {...props}
                  icon={props.isExpanded ? "chevron-up" : "chevron-down"}
                  color={theme.colors.onSurfaceVariant}
                />
              )}
            >
              {section.content}
            </List.Accordion>
          </React.Fragment>
        ))}
      </List.AccordionGroup>
      {sections.length > 0 && <Divider testID="trail-misc-divider" />}
      <List.Item
        testID="trail-misc-guide"
        title={
          <View style={s.guideTitle}>
            <Text style={[s.titleText, { color: theme.colors.onSurface }]}>{t("guide.title")}</Text>
            <Icon source="pine-tree" size={16} color={theme.colors.primary} />
          </View>
        }
        description={t("trail.guideLink")}
        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
        onPress={onOpenGuide}
        accessibilityRole="link"
        right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
      />
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 10,
    padding: 10,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  titleText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  guideTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  accordionContent: {
    paddingLeft: 10,
  },
});
