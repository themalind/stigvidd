import { Surface, Text } from "react-native-paper";
import { Review } from "@/data/types";

interface ReviewProps {
  reviews: Review[];
}

export default function ReviewComponent({ reviews }: ReviewProps) {
  return reviews.map((r) => (
    <Surface key={r.identifier}>
      <Text>{r.userName}</Text>
    </Surface>
  ));
}
