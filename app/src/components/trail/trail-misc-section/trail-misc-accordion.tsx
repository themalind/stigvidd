import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Trail } from "@/data/types";
import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { Divider, List, Surface, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import FullDescriptionSection from "./full-description-section";
import LinkSection from "./link-section";
import VisitorInformationSection from "./visitor-information-section";

interface Props {
  trail: Trail;
}
export default function TrailMiscInfo({ trail }: Props) {
  const [expandedId, setExpandedId] = useState<string | number>("1");
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Surface elevation={0} style={[s.container, { backgroundColor: theme.colors.surface }]}>
      <List.AccordionGroup
        expandedId={expandedId}
        onAccordionPress={(id) => setExpandedId((prev) => (prev === id ? "" : id))}
      >
        {trail.visitorInformation && (
          <>
            <List.Accordion
              titleStyle={[s.titleText, { color: theme.colors.onSurface }]}
              contentStyle={s.accordionContent}
              title={t("trail.practicalInfo")}
              id="1"
              style={{ backgroundColor: theme.colors.surface }}
              right={(props) => (
                <List.Icon
                  {...props}
                  icon={props.isExpanded ? "chevron-up" : "chevron-down"}
                  color={theme.colors.onSurfaceVariant}
                />
              )}
            >
              <VisitorInformationSection visitorInfo={trail.visitorInformation} />
            </List.Accordion>
            <Divider />
          </>
        )}
        {trail.fullDescription && (
          <>
            <List.Accordion
              titleStyle={[s.titleText, { color: theme.colors.onSurface }]}
              contentStyle={s.accordionContent}
              title={t("trail.detailedDescription")}
              id="2"
              style={{ backgroundColor: theme.colors.surface }}
              right={(props) => (
                <List.Icon
                  {...props}
                  icon={props.isExpanded ? "chevron-up" : "chevron-down"}
                  color={theme.colors.onSurfaceVariant}
                />
              )}
            >
              <FullDescriptionSection fullDescription={trail.fullDescription} />
            </List.Accordion>
            <Divider />
          </>
        )}

        {trail.trailLinksResponse?.length ? (
          <List.Accordion
            titleStyle={[s.titleText, { color: theme.colors.onSurface }]}
            contentStyle={s.accordionContent}
            title={t("trail.links")}
            id="3"
            style={{ backgroundColor: theme.colors.surface }}
            right={(props) => (
              <List.Icon
                {...props}
                icon={props.isExpanded ? "chevron-up" : "chevron-down"}
                color={theme.colors.onSurfaceVariant}
              />
            )}
          >
            <LinkSection links={trail.trailLinksResponse} />
          </List.Accordion>
        ) : null}
      </List.AccordionGroup>
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
  accordionContent: {
    paddingLeft: 10,
  },
});
