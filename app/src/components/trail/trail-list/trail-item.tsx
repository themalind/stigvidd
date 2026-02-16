import { userThemeAtom } from "@/atoms/user-theme-atom";
import { TrailShortInfoResponse } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { FontAwesome6, Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAtom } from "jotai";
import React, { memo } from "react";
import { Appearance, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface TrailItemProps {
  item: TrailShortInfoResponse;
  handlePress: (identifier: string) => void;
}

export function blobMaker(classification: string) {
  switch (classification) {
    case "Svår":
      return <Ionicons name="triangle" size={10} color="#f50" />;
    case "Medel":
      return <FontAwesome6 name="diamond" size={10} color="#bbaa00" />;
    case "Lätt":
      return <MaterialIcons name="circle" size={10} color="green" />;
    case "Inte klassificerad":
      return <MaterialIcons name="circle" size={10} color="grey" />;
  }
}

function TrailItem({ item, handlePress }: TrailItemProps) {
  const theme = useTheme();
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = Appearance.getColorScheme();
  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;
  const wizardPin =
    finalTheme === "dark"
      ? require("../../../assets/map/marker/vandringsled-dark-100-159.png")
      : require("../../../assets/map/marker/vandringsled-100-159.png");

  return (
    <Pressable
      onPress={() => handlePress(item.identifier)}
      style={[s.trailCard, { backgroundColor: theme.colors.surface }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, flexShrink: 1 }}>
          <Image source={wizardPin} style={{ height: 20, width: 20 }} contentFit="contain" />
          <Text style={[s.trailName, { flexShrink: 1 }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={[s.infoText, { flex: 1 }]} numberOfLines={1}>
          {item.city}
        </Text>
        <Text style={[s.infoText, { width: 60, textAlign: "right" }]} numberOfLines={1}>
          {item.trailLength} km
        </Text>
        <View style={{ width: 100, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" }}>
          {item.classification != null && (
            <>
              <Text>{blobMaker(classificationParser(item.classification))}</Text>
              <Text style={[s.infoText]}>{classificationParser(item.classification)}</Text>
            </>
          )}
        </View>
        {item.accessibility ? (
          <View style={[s.accessibilityBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
            <MaterialCommunityIcons name="wheelchair-accessibility" size={16} color={theme.colors.tertiary} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default memo(TrailItem);

const s = StyleSheet.create({
  trailCard: {
    flex: 1,
    flexDirection: "column",
    borderRadius: 10,
    padding: 10,
    gap: 5,
  },
  trailName: {
    fontSize: 13,
    fontWeight: "700",
  },
  accessibilityBadge: {
    padding: 4,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 12,
  },
});
