import { getPopularTrails } from "@/api/trails";
import ImageCarousel from "@/components/image-carousel";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import React from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

const HEIGHT = Dimensions.get("screen").height;

export default function HomeScreen() {
  const theme = useTheme();
  const image = require("../../assets/images/mock-map-trails.png");

  const query = useQuery({
    queryKey: ["trails", "popular"],
    queryFn: getPopularTrails,
  });
  // Fixa
  // LOG  VirtualizedList: You have a large list that is slow to update
  // - make sure your renderItem function renders components that follow React performance best practices like PureComponent,
  // shouldComponentUpdate, etc. {"contentLength": 2460.0888671875, "dt": 13181, "prevDt": 586}

  if (query.isPending) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
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
    <ScrollView
      contentContainerStyle={[
        s.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>
        Populära promenader nära dig
      </Text>

      <ImageCarousel data={query.data} />
      <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>
        Hitta på kartan
      </Text>
      <Image contentFit="contain" source={image} style={s.image} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 10,
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 15,
  },
  image: {
    width: "auto",
    height: HEIGHT * 0.3,
    marginTop: -40,
    borderRadius: 20,
  },
});
