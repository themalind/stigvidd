import { getPopularTrails } from "@/api/trails";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import ImageCarousel from "@/components/image-carousel";
import LoadingIndicator from "@/components/loading-indicator";
import Map from "@/components/map/map";
import MockNews from "@/components/mockNews";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useAtom } from "jotai";
import React from "react";
import { Appearance, Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { Divider, Surface, useTheme } from "react-native-paper";

const HEIGHT = Dimensions.get("screen").height;

export default function HomeScreen() {
  const theme = useTheme();
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = Appearance.getColorScheme();
  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;
  const hikers =
    finalTheme === "dark"
      ? require("../../assets/images/mrHike-light.png")
      : require("../../assets/images/mrHike-dark.png");

  const query = useQuery({
    queryKey: ["trails", "popular"],
    queryFn: getPopularTrails,
  });

  if (query.isPending) {
    return <LoadingIndicator />;
  }

  if (query.error) {
    console.log(query.error);
    return (
      <View>
        <Text>Fel vid hämtning</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}>
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
      <ImageCarousel data={query.data} />

      <Divider />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color={theme.colors.onBackground} />
        <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>Hitta på kartan</Text>
      </View>
      <Surface style={s.mapContainer}>
        <Map
          style={s.map}
          initialRegion={{
            latitude: 57.721,
            longitude: 12.9401,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        />
      </Surface>

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
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
  map: {
    flex: 1,
  },
  mapContainer: {
    height: HEIGHT * 0.25,
    borderRadius: 10,
    overflow: "hidden",
  },
  hikers: {
    height: 25,
    width: 25,
  },
  winners: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
});
