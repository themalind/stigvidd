import { getPopularTrails } from "@/api/trails";
import { locationResolvedAtom, userLocationAtom } from "@/atoms/location-atoms";
import MockNews from "@/components/mockNews";
import CarouselSkeleton from "@/components/skeletons/carousel-skeleton";
import ImageCarousel from "@/components/trail/image-carousel";
import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useAtomValue } from "jotai";
import React, { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Divider, useTheme } from "react-native-paper";

export default function HomeScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const userLocation = useAtomValue(userLocationAtom);
  const locationResolved = useAtomValue(locationResolvedAtom);
  const hikers = theme.dark
    ? require("../../../assets/images/mrHike-light.png")
    : require("../../../assets/images/mrHike-dark.png");

  const query = useQuery({
    queryKey: ["trails", "popular", userLocation?.latitude, userLocation?.longitude],
    queryFn: () => getPopularTrails(userLocation?.latitude, userLocation?.longitude),
    enabled: locationResolved,
  });

  // Scroll to top when screen is focused or bottomtab is pressed.
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return (
    <ScrollView ref={scrollViewRef} contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}>
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          alignItems: "center",
        }}
      >
        <Image contentFit="contain" source={hikers} style={s.hikers} />
        <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>Populära promenader nära dig</Text>
      </View>
      {query.data ? <ImageCarousel data={query.data} /> : <CarouselSkeleton />}
      <Divider />
      <Pressable style={s.guideCard} onPress={() => router.push("/(tabs)/(settings)/guide")}>
        <Image
          source={require("../../../assets/images/guide_cover.jpg")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <View style={s.guideOverlay}>
          <Text style={s.guideTitle}>Naturguide</Text>
          <Text style={s.guideSubtitle}>Allemansrätt · Naturreservat · Svårighetsgrader</Text>
        </View>
      </Pressable>
      <Divider />
      <Pressable style={s.areasCard} onPress={() => router.push("/(tabs)/(home)")}>
        <View style={s.collage}>
          <View style={s.collageRow}>
            <Image
              source={require("../../../assets/images/area_cover1.jpg")}
              style={s.collageImage}
              contentFit="cover"
            />
            <Image
              source={require("../../../assets/images/area_cover2.jpg")}
              style={s.collageImage}
              contentFit="cover"
            />
          </View>
          <View style={s.collageRow}>
            <Image
              source={require("../../../assets/images/area_cover3.jpg")}
              style={s.collageImage}
              contentFit="cover"
            />
            <Image
              source={require("../../../assets/images/area_cover4.jpg")}
              style={s.collageImage}
              contentFit="cover"
            />
          </View>
        </View>
        <View style={s.guideOverlay}>
          <Text style={s.guideTitle}>Utforska Borås</Text>
          <Text style={s.guideSubtitle}>Rya åsar · Kype · Kransmossen · Torpanäset</Text>
        </View>
      </Pressable>
      <Divider />
      <View style={{ gap: 20 }}>
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            paddingHorizontal: 5,
          }}
        >
          <Ionicons name="newspaper-outline" size={24} color={theme.colors.onBackground} />
          <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>Nyheter</Text>
        </View>
        <MockNews />
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 10,
    paddingTop: 20,
    paddingBottom: 30,
    gap: 20,
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 15,
  },
  hikers: {
    height: 25,
    width: 25,
  },
  areasCard: {
    height: 220,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  collage: {
    flex: 1,
    gap: 2,
  },
  collageRow: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
  },
  collageImage: {
    flex: 1,
  },
  weatherCard: {
    height: 160,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  guideCard: {
    height: 140,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    padding: 14,
  },
  guideTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  guideSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
});
