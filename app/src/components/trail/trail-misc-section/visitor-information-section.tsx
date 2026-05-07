import { BORDER_RADIUS } from "@/constants/constants";
import { VisitorInformation } from "@/data/types";
import { StyleSheet, View } from "react-native";
import { Divider, Icon, Text, useTheme } from "react-native-paper";

interface Props {
  visitorInfo: VisitorInformation;
}

export default function VisitorInformationSection({ visitorInfo }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.colors.secondaryContainer }]}>
      <View style={s.propertyContainer}>
        <View
          style={[s.iconBox, { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary }]}
        >
          <Icon size={25} source="map-search-outline" color={theme.colors.onTertiaryContainer} />
        </View>
        <Text style={s.propertyText}>{visitorInfo.gettingThere}</Text>
      </View>
      <Divider style={{ backgroundColor: theme.colors.onSurface }} />

      <View style={s.propertyContainer}>
        <View
          style={[s.iconBox, { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary }]}
        >
          <Icon size={25} source="bus" color={theme.colors.onTertiaryContainer} />
        </View>
        <Text style={s.propertyText}>{visitorInfo.publicTransport}</Text>
      </View>
      <Divider style={{ backgroundColor: theme.colors.onSurface }} />

      <View style={s.propertyContainer}>
        <View
          style={[s.iconBox, { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary }]}
        >
          <Icon size={25} source="parking" color={theme.colors.onTertiaryContainer} />
        </View>
        <Text style={s.propertyText}>{visitorInfo.parking}</Text>
      </View>

      {visitorInfo.maintainedBy && (
        <>
          <Divider style={{ backgroundColor: theme.colors.onSurface }} />
          <View style={s.propertyContainer}>
            <View
              style={[
                s.iconBox,
                { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary },
              ]}
            >
              <Icon source={"account-hard-hat"} size={25} color={theme.colors.onTertiaryContainer} />
            </View>
            <Text style={s.propertyText}>{visitorInfo.maintainedBy}</Text>
          </View>
        </>
      )}
      {visitorInfo.illumination && visitorInfo.illuminationText && (
        <>
          <Divider style={{ backgroundColor: theme.colors.onSurface }} />
          <View style={s.propertyContainer}>
            <View
              style={[
                s.iconBox,
                { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary },
              ]}
            >
              <Icon source="outdoor-lamp" size={25} color={theme.colors.onTertiaryContainer} />
            </View>
            <Text style={s.propertyText}>{visitorInfo.illuminationText}</Text>
          </View>
        </>
      )}
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
