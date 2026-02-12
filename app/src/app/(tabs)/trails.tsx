import { getAllTrails } from "@/api/trails";
import LoadingIndicator from "@/components/loading-indicator";
import DropdownMenu, { MenuOption } from "@/components/trail/dropdown-menu";
import { TrailShortInfoResponse } from "@/data/types";
import { FontAwesome } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

export default function TrailsScreen() {
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [visible, setVisible] = useState(false);
  const [sortBy, setSortBy] = useState("");

  // Scrolla till toppen när skärmen fokuseras (vid tab-tryck)
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const {
    data: trailsList,
    isLoading,
    isError,
    error,
  } = useQuery<TrailShortInfoResponse[]>({
    queryKey: ["traillist", "trailScreen"],
    queryFn: () => getAllTrails(),
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <Text style={{ padding: 20, color: theme.colors.error }}>{error?.message}</Text>;
  }

  const handlePress = (identifier: string) => {
    router.navigate({
      pathname: "/(tabs)/(stacks)/trail/[identifier]",
      params: { identifier: identifier },
    });
  };
  return (
    <ScrollView ref={scrollViewRef} contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 20 }}>
        <Text style={{ fontSize: 20, color: theme.colors.onBackground }}>Vandringsleder</Text>

        <View style={s.containerDrop}>
          <DropdownMenu
            visible={visible}
            handleOpen={() => setVisible(true)}
            handleClose={() => setVisible(false)}
            trigger={
              <View style={s.triggerStyle}>
                <FontAwesome name="sort-amount-desc" size={25} color={theme.colors.onBackground} />
              </View>
            }
          >
            <Text>Sortera</Text>
            <MenuOption
              onSelect={() => {
                setSortBy("name");
                setVisible(false);
              }}
            >
              <Text>Namn</Text>
            </MenuOption>
            <MenuOption
              onSelect={() => {
                setSortBy("length");
                setVisible(false);
              }}
            >
              <Text>Längd</Text>
            </MenuOption>
            <MenuOption
              onSelect={() => {
                setSortBy("accessibility");
                setVisible(false);
              }}
            >
              <Text>Tillgänglighet</Text>
            </MenuOption>
            <MenuOption
              onSelect={() => {
                setSortBy("location");
                setVisible(false);
              }}
            >
              <Text>Ort</Text>
            </MenuOption>
          </DropdownMenu>
        </View>
      </View>
      {trailsList &&
        trailsList.map((trail) => (
          <View key={trail.identifier}>
            <Pressable style={s.pressable} onPress={() => handlePress(trail.identifier)}>
              <Text style={{ color: theme.colors.onBackground }}>{trail.name}</Text>
            </Pressable>
          </View>
        ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    gap: 10,
  },
  pressable: {
    padding: 10,
    backgroundColor: "green",
  },
  containerDrop: {
    justifyContent: "center",
    alignItems: "center",
  },
  triggerStyle: {
    height: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  triggerText: {
    fontSize: 16,
  },
});
