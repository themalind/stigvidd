import { Image, ImageStyle, StyleProp } from "react-native";
import { NoImage } from "./no-image";

interface ImageHandlerProp {
  style?: StyleProp<ImageStyle>;
  item: any;
}

export const ImageHandler = ({ style, item }: ImageHandlerProp) => {
  return (
    <>
      {item.imageUrl === "" ? (
        <NoImage style={style} />
      ) : typeof item.imageUrl === "string" ? (
        <Image source={{ uri: item.imageUrl }} style={style} />
      ) : (
        <Image source={item.imageUrl} style={style} />
      )}
    </>
  );
};
