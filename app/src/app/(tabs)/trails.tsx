import TrailCreator from "@/components/trail/trail-creator/trail-creator";
import { useFocusEffect } from "expo-router";
import React, { useRef } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useTheme } from "react-native-paper";

export default function TrailsScreen() {
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  // Scrolla till toppen när skärmen fokuseras (vid tab-tryck)
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return (
    <ScrollView ref={scrollViewRef} contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}>
      <Text style={{ color: theme.colors.onBackground }}>trails</Text>

      <TrailCreator />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 10,
  },
});
