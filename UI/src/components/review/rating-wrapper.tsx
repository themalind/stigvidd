import { showSuccessAtom } from "@/atoms/snackbar-atoms";
import { Trail } from "@/data/types";
import { Ionicons } from "@expo/vector-icons";
import { useSetAtom } from "jotai";
import { RefObject } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";
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
  const reviews = trail?.reviewsResponse ?? [];
  const setCreateReviewMsg = useSetAtom(showSuccessAtom);

  const handlePress = () => {
    setCreateReviewMsg("Din recension är tillagd!");
  };

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
      <View style={{ flexDirection: "row" }}>
        <View style={s.ratingSection}>
          <Text style={[s.title, { color: theme.colors.tertiary }]}>
            Recensioner
          </Text>
          <Text style={[s.ratingNumber, { color: theme.colors.tertiary }]}>
            {`(${reviews.length})`}
          </Text>
        </View>
        <View style={s.iconSection}>
          <Pressable onPress={handlePress}>
            <Ionicons
              name="create-outline"
              size={30}
              color={theme.colors.onBackground}
            />
          </Pressable>
        </View>
      </View>
      <TrailReviews reviews={reviews} />
    </Surface>
  );
}

const s = StyleSheet.create({
  surface: {
    justifyContent: "center",
    borderRadius: 20,
    padding: 25,
  },
  title: {
    fontWeight: 700,
    fontSize: 20,
  },
  iconSection: {
    gap: 15,
    paddingRight: 5,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    flex: 1,
  },
  ratingNumber: {
    fontSize: 15,
  },
  ratingContainer: {
    transform: [{ translateX: -5 }],
    paddingTop: 10,
  },
  ratingSection: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 15,
  },
});
