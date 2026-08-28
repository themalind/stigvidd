import { BORDER_RADIUS } from "@/constants/constants";
import { VisitorInformation } from "@/data/types";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Divider, Icon, Text, useTheme } from "react-native-paper";

interface Props {
  visitorInfo: VisitorInformation;
}

export default function VisitorInformationSection({ visitorInfo }: Props) {
  const theme = useTheme();
  // Bara ifyllda fält blir rader, och avdelarna sitter mellan dem.
  const rows = [
    { icon: "map-search-outline", text: visitorInfo.gettingThere },
    { icon: "bus", text: visitorInfo.publicTransport },
    { icon: "parking", text: visitorInfo.parking },
    { icon: "account-hard-hat", text: visitorInfo.maintainedBy },
    { icon: "outdoor-lamp", text: visitorInfo.illumination ? visitorInfo.illuminationText : "" },
  ].filter((row) => !!row.text);

  return (
    <View style={[s.container, { backgroundColor: theme.colors.surface }]}>
      {rows.map((row, index) => (
        <React.Fragment key={row.icon}>
          {index > 0 && <Divider />}
          <View style={s.propertyContainer}>
            <View
              style={[
                s.iconBox,
                { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant },
              ]}
            >
              <Icon size={25} source={row.icon} color={theme.colors.onSurfaceVariant} />
            </View>
            <Text style={s.propertyText}>{row.text}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 10,
  },
  propertyContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingTop: 10,
    paddingBottom: 10,
  },
  propertyText: {
    flex: 1,
    lineHeight: 20,
  },
  iconBox: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    padding: 8,
  },
});
