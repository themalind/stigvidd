import { BORDER_RADIUS } from "@/constants/constants";
import { CityArea, FacilityType, hasFacilityType } from "@/data/types";
import { guardedNavigate } from "@/utils/navigation";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

const IMAGE_HEIGHT = 190;

interface Props {
  area: CityArea;
}

type FacilityTypeValue = (typeof FacilityType)[keyof typeof FacilityType];

interface FacilityChip {
  key: string;
  type: FacilityTypeValue;
  icon: string;
  label: string;
}

export default function AreaCard({ area }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  // OR every facility's flags together so we can test which kinds exist in the area.
  const facilityFlags = area.facilities.reduce<number>((acc, f) => acc | f.facilityType, FacilityType.None);

  const chips: FacilityChip[] = [
    { key: "fire", type: FacilityType.FirePit, icon: "campfire", label: t("area.firePits") },
    { key: "shelter", type: FacilityType.Shelter, icon: "tent", label: t("area.shelters") },
    { key: "fishing", type: FacilityType.FishingArea, icon: "fish", label: t("area.fishing") },
    { key: "swimming", type: FacilityType.SwimmingArea, icon: "swim", label: t("area.swimming") },
    { key: "nature", type: FacilityType.NatureReserve, icon: "pine-tree", label: t("area.natureReserve") },
  ].filter((c) => hasFacilityType(facilityFlags, c.type));

  const trailCount = area.trails.length;
  const totalKm = Math.round(area.trails.reduce((sum, tr) => sum + (tr.trailLength ?? 0), 0));

  const cardBackground = theme.dark ? theme.colors.elevation.level2 : theme.colors.surface;

  const accentColor = theme.dark ? theme.colors.primary : theme.colors.tertiary;
  const accentTop = IMAGE_HEIGHT;

  return (
    <Pressable
      onPress={() =>
        guardedNavigate(() =>
          router.navigate({
            pathname: "/(tabs)/(home)/area/[identifier]",
            params: { identifier: area.identifier },
          }),
        )
      }
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: cardBackground,
          borderColor: theme.colors.outlineVariant,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={s.imageWrap}>
        <Image
          source={{ uri: area.imageUrl }}
          style={s.image}
          contentFit="cover"
          transition={200}
          recyclingKey={area.identifier}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.75)"]}
          locations={[0, 0.5, 1]}
          style={s.gradient}
        />
        <View style={s.overlay}>
          <Text style={s.name} numberOfLines={1}>
            {area.name}
          </Text>
          {!!area.location && (
            <View style={s.locationRow}>
              <Icon source="map-marker" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={s.location} numberOfLines={1}>
                {area.location}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.body}>
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Icon source="hiking" size={16} color={theme.colors.primary} />
            <Text style={[s.statText, { color: theme.colors.onSurface }]}>
              {trailCount} {t("area.trailsShort")}
            </Text>
          </View>
          {totalKm > 0 && (
            <View style={s.stat}>
              <Icon source="map-marker-distance" size={16} color={theme.colors.primary} />
              <Text style={[s.statText, { color: theme.colors.onSurface }]}>
                {totalKm} {t("area.km")}
              </Text>
            </View>
          )}

          {chips.length > 0 && (
            <View style={s.chips}>
              {chips.map((c) => (
                <View
                  key={c.key}
                  accessibilityLabel={c.label}
                  style={[s.chip, { backgroundColor: theme.colors.secondaryContainer }]}
                >
                  <Icon source={c.icon} size={15} color={theme.colors.onSecondaryContainer} />
                </View>
              ))}
            </View>
          )}
        </View>

        {!!area.description && (
          <Text style={[s.description, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
            {area.description}
          </Text>
        )}
      </View>

      <View style={[s.accent, { backgroundColor: accentColor, top: accentTop }]} pointerEvents="none" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  accent: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 4,
  },
  imageWrap: {
    height: IMAGE_HEIGHT,
    width: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: "#fff",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  location: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
  },
  chip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
});
