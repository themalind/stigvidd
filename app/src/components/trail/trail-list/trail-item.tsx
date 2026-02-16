import { TrailShortInfoResponse } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface TrailItemProps {
  item: TrailShortInfoResponse;
  handlePress: (identifier: string) => void;
}

function TrailItem({ item, handlePress }: TrailItemProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => handlePress(item.identifier)}
      style={[s.trailCard, { backgroundColor: theme.colors.surface }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 15, flex: 1, flexShrink: 1 }}>
          <Text style={[s.trailName, { flexShrink: 1 }]} numberOfLines={1}>
            📍{item.name}
          </Text>
          {item.accessibility ? (
            <View style={[s.accessibilityBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
              <MaterialCommunityIcons name="wheelchair-accessibility" size={16} color={theme.colors.tertiary} />
            </View>
          ) : null}
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 25 }}>
        <Text style={s.infoText}> {item.city}</Text>
        <Text style={s.infoText}> {item.trailLength} km</Text>
        {item.classification != null && <Text style={s.infoText}>{classificationParser(item.classification)}</Text>}
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
    padding: 15,
    gap: 10,
  },
  trailName: {
    fontSize: 15,
    fontWeight: "700",
  },
  accessibilityBadge: {
    padding: 4,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
  },
});
