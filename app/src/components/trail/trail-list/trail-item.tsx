import { userThemeAtom } from "@/atoms/user-theme-atom";
import { BORDER_RADIUS } from "@/constants/constants";
import { TrailShortInfoResponse } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAtom } from "jotai";
import React, { memo } from "react";
import { Appearance, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface TrailItemProps {
  item: TrailShortInfoResponse;
  handlePress: (identifier: string) => void;
}

function TrailItem({ item, handlePress }: TrailItemProps) {
  const theme = useTheme();
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = Appearance.getColorScheme();
  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;
  const wizardPin =
    finalTheme === "dark"
      ? require("../../../assets/map/marker/vandringsled-dark-90-143.png")
      : require("../../../assets/map/marker/vandringsled-90-143.png");

  return (
    <Pressable
      onPress={() => handlePress(item.identifier)}
      style={[s.trailCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
    >
      <View style={s.topRow}>
        <View style={s.nameRow}>
          <Image source={wizardPin} style={s.pinIcon} contentFit="contain" />
          <Text style={s.trailName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.accessibility ? (
            <View style={[s.accessibilityBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
              <MaterialCommunityIcons name="wheelchair-accessibility" size={14} color={theme.colors.tertiary} />
            </View>
          ) : null}
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
      </View>
      <View style={s.bottomRow}>
        <Text style={[s.infoText, s.cityText]} numberOfLines={1}>
          {item.city}
        </Text>
        <Text style={[s.infoText, s.lengthText]} numberOfLines={1}>
          {item.trailLength} km
        </Text>
        <View style={s.classificationContainer}>
          {item.classification != null && item.classification !== 0 && (
            <>
              <View style={s.difficultyIconWrapper}>
                <Text>{getDifficultyIcon(classificationParser(item.classification))}</Text>
              </View>
              <Text style={[s.infoText, s.difficultyText]}>{classificationParser(item.classification)}</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(TrailItem);

const s = StyleSheet.create({
  trailCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  pinIcon: {
    height: 20,
    width: 20,
  },
  trailName: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    letterSpacing: 0.4,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cityText: {
    flex: 1,
  },
  lengthText: {
    width: 60,
    textAlign: "left",
  },
  classificationContainer: {
    width: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    paddingRight: 2,
  },
  difficultyIconWrapper: {
    width: 16,
    alignItems: "center",
  },
  difficultyText: {
    width: 48,
    textAlign: "left",
  },
  accessibilityBadge: {
    padding: 4,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 12,
  },
});
