import { Trail } from "@/data/types";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { RefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";
import { Rating } from "./rating";
import TrailReviews from "./trail-reviews";

interface RatingProps {
  trail?: Trail;
  surfaceToScrollToRef: RefObject<View | null>;
}

export default function RatingWrapper({
  trail,
  surfaceToScrollToRef,
}: RatingProps) {
  const theme = useTheme();
  const reviews = trail?.reviewDTO ?? [];

  if (reviews.length === 0) {
    return (
      <Surface
        elevation={4}
        ref={surfaceToScrollToRef}
        mode="elevated"
        style={[s.surface, { backgroundColor: theme.colors.surface }]}
      >
        <Text style={{ color: theme.colors.onBackground }}>
          Det finns inga recensioner här ännu.
        </Text>
      </Surface>
    );
  }

  return (
    <Surface
      ref={surfaceToScrollToRef}
      elevation={4}
      mode="elevated"
      style={[s.surface, { backgroundColor: theme.colors.surface }]}
    >
      <Text style={[s.title, { color: theme.colors.tertiary }]}>
        Recensioner
      </Text>
      <Rating trailReviews={trail?.reviewDTO} starSize={17} />
      <View
        style={{
          flexDirection: "row",
          gap: 15,
          justifyContent: "flex-end",
          alignItems: "flex-end",
        }}
      >
        <MaterialIcons
          name="filter-list"
          size={25}
          color={theme.colors.onBackground}
        />
        <Ionicons
          name="create-outline"
          size={25}
          color={theme.colors.onBackground}
        />
      </View>
      <TrailReviews reviews={reviews} />
    </Surface>
  );
}

const s = StyleSheet.create({
  surface: {
    justifyContent: "center",
    gap: 10,
    borderRadius: 20,
    padding: 15,
  },
  title: {
    fontWeight: 700,
    fontSize: 20,
  },
});
