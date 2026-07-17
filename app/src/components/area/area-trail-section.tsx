import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { CityAreaTrail } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { guardedNavigate } from "@/utils/navigation";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { Rating } from "../review/rating";

interface AreaTrailSectionProps {
  trails: CityAreaTrail[];
}

export default function AreaTrailSection({ trails }: AreaTrailSectionProps) {
  const theme = useTheme();

  return (
    <View style={s.section}>
      {trails.map((trail) => {
        const difficulty = classificationParser(trail.classification ?? 0);
        return (
          <Pressable
            key={trail.identifier}
            onPress={() =>
              guardedNavigate(() =>
                router.navigate({
                  pathname: "/(tabs)/(home)/trail/[identifier]",
                  params: { identifier: trail.identifier },
                }),
              )
            }
            style={({ pressed }) => [
              s.card,
              {
                backgroundColor: theme.colors.elevation.level1,
                borderColor: theme.colors.outlineVariant,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Image source={trail.image?.imageUrl} contentFit="cover" style={s.image} />
            <View style={s.body}>
              <Text style={[s.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {trail.name}
              </Text>
              <View style={s.metaRow}>
                <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]}>{trail.trailLength} km</Text>
                <View style={s.difficulty}>
                  {getDifficultyIcon(difficulty)}
                  <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]}>{difficulty}</Text>
                </View>
                <Rating
                  averageRating={trail.averageRating}
                  starColor={theme.colors.onSurfaceVariant}
                  textStyle={[s.meta, { color: theme.colors.onSurfaceVariant }]}
                />
              </View>
              {trail.description ? (
                <Text style={[s.description, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
                  {trail.description}
                </Text>
              ) : null}
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} style={s.chevron} />
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  image: {
    width: 64,
    height: 84,
    borderRadius: BORDER_RADIUS,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  difficulty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    fontSize: 13,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    flexShrink: 0,
  },
});
