import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

interface NoImageProp {
  style?: StyleProp<ImageStyle>;
}

export const NoImage = ({ style }: NoImageProp) => {
  return (
    <Image source={require("../assets/images/noImage.png")} style={style} />
  );
};
