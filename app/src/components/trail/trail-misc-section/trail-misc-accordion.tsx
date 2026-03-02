import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Trail } from "@/data/types";
import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { Divider, List, Surface, useTheme } from "react-native-paper";
import FullDescriptionSection from "./full-description-section";
import LinkSection from "./link-section";
import VisitorInformationSection from "./visitor-information-section";

interface Props {
  trail: Trail;
}
export default function TrailMiscInfo({ trail }: Props) {
  const [expandedId, setExpandedId] = useState<string | number>("1");
  const theme = useTheme();
  return (
    <Surface elevation={2} style={[s.container, { backgroundColor: theme.colors.surface }]}>
      <List.AccordionGroup
        expandedId={expandedId}
        onAccordionPress={(id) => setExpandedId((prev) => (prev === id ? "" : id))}
      >
        {trail.visitorInformation && (
          <>
            <List.Accordion
              titleStyle={[s.titleText, { color: theme.colors.onSurface }]}
              title="Praktisk information"
              id="1"
              style={{ backgroundColor: theme.colors.surface }}
            >
              <VisitorInformationSection visitorInfo={trail.visitorInformation} />
            </List.Accordion>
            <Divider />
          </>
        )}
        {trail.fullDescription && (
          <List.Accordion
            titleStyle={[s.titleText, { color: theme.colors.onSurface }]}
            title="Detaljerad beskrivning"
            id="2"
            style={{ backgroundColor: theme.colors.surface }}
          >
            <FullDescriptionSection fullDescription={trail.fullDescription} />
          </List.Accordion>
        )}
        <Divider />
        {trail.trailLinksResponse?.length ? (
          <List.Accordion
            titleStyle={[s.titleText, { color: theme.colors.onSurface }]}
            title="Länkar"
            id="3"
            style={{ backgroundColor: theme.colors.surface }}
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
    fontWeight: 700,
  },
});
