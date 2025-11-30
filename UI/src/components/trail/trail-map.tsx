import { Trail } from "@/data/types";
import { Dimensions, StyleSheet } from "react-native";
import { Image } from "expo-image";

interface TrailMapProps {
  trail: Trail;
}

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;

export default function TrailMap({ trail }: TrailMapProps) {
  const image = require("../../assets/images/mock-map.png");
  return <Image contentFit="contain" source={image} style={s.image} />;
}

const s = StyleSheet.create({
  image: {
    width: WIDTH * 0.9,
    height: HEIGHT * 0.3,
  },
});
