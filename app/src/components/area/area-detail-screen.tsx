import { getAreaByIdentifier } from "@/api/areas";
import { CITY_AREAS_STALE_TIME } from "@/constants/cache";
import { SCREEN_PADDING } from "@/constants/constants";
import { asTranslationKey } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import BackButton from "../back-button";
import ErrorView from "../error-view";
import LoadingIndicator from "../loading-indicator";
import AreaTrailSection from "./area-trail-section";
import FacilitySection from "./facility-section";

export default function AreaDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ identifier: string }>();

  const {
    data: area,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cityArea", params.identifier],
    queryFn: () => getAreaByIdentifier(params.identifier),
    staleTime: CITY_AREAS_STALE_TIME,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError || area === undefined) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  const firePits = area.facilities.filter((f) => f.facilityType === 1);
  const fishing = area.facilities.filter((f) => f.facilityType === 4);
  const shelter = area.facilities.filter((f) => f.facilityType === 2);
  const swimming = area.facilities.filter((f) => f.facilityType === 8);
  const naturereserve = area.facilities.filter((f) => f.facilityType === 16);

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.backButtonRow}>
          <BackButton />
        </View>
        <Image source={{ uri: area.imageUrl }} style={s.heroImage} resizeMode="cover" />
        <View style={s.header}>
          <Text style={[s.title, { color: theme.colors.onBackground }]}>{area?.name}</Text>
          <View style={s.locationRow}>
            <MaterialIcons name="place" size={16} color={theme.colors.primary} />
            <Text style={[s.locationText, { color: theme.colors.onSurfaceVariant }]}>
              {t(asTranslationKey(area?.location))}
            </Text>
          </View>
        </View>
        {area.description ? (
          <Text style={[s.description, { color: theme.colors.onBackground }]}>
            {t(asTranslationKey(area.description))}
          </Text>
        ) : null}
        {area.trails && area.trails.length > 0 && (
          <>
            <Divider />
            <Text style={[s.facilitiesHeading, { color: theme.colors.onBackground }]}>{t("area.trails")}</Text>
            <AreaTrailSection trails={area.trails} />
          </>
        )}
        {area.facilities && area.facilities.length > 0 && (
          <>
            <Divider />
            <Text style={[s.facilitiesHeading, { color: theme.colors.onBackground }]}>{t("area.facilities")}</Text>
            <FacilitySection title={t("area.firePits")} icon="outdoor-grill" items={firePits} />
            <FacilitySection title={t("area.shelters")} icon="cabin" items={shelter} />
            <FacilitySection title={t("area.fishing")} icon="set-meal" items={fishing} />
            <FacilitySection title={t("area.swimming")} icon="pool" items={swimming} />
            <FacilitySection title={t("area.natureReserve")} icon="park" items={naturereserve} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    gap: 16,
    paddingBottom: 32,
  },
  backButtonRow: {
    paddingTop: 4,
  },
  heroImage: {
    width: "100%",
    height: 220,
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 14,
  },
  description: {
    paddingHorizontal: SCREEN_PADDING,
    fontSize: 15,
    lineHeight: 22,
  },
  facilitiesHeading: {
    paddingHorizontal: SCREEN_PADDING,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
