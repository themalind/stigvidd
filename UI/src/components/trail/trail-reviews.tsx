import { Review } from "@/data/types";
import { StyleSheet, View } from "react-native";
import { Divider, Text } from "react-native-paper";
import { Rating } from "./rating";

interface ReviewProps {
  reviews: Review[];
}

const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

export default function TrailReviews({ reviews }: ReviewProps) {
  return reviews.map((r) => (
    <View style={s.container} key={r.identifier}>
      <Divider bold={true} />
      <View style={s.user}>
        <Text style={s.userName}>{r.userName}</Text>
        <Rating review={r} starSize={13} />
      </View>
      <View>
        <Text>{formatDate(new Date(r.createdAt))}</Text>
        {r.trailReview && <Text>{r.trailReview}</Text>}
      </View>
    </View>
  ));
}

const s = StyleSheet.create({
  container: {
    gap: 5,
  },
  user: {
    justifyContent: "space-between",
    flexDirection: "row",
  },
  userName: {
    fontWeight: 700,
  },
});
