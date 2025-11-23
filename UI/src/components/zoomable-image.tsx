import { Image } from "expo-image";
import { Zoomable } from "@likashefqet/react-native-image-zoom";
import { StyleSheet, View } from "react-native";
// https://medium.com/@andrew.chester/react-native-expo-full-screen-image-viewer-with-zoom-made-simple-d374081acc6d

interface ImageProp {
  imageUri: string;
}

export default function ZoomableImage({ imageUri }: ImageProp) {
  return (
    <View style={styles.container}>
      <Zoomable isDoubleTapEnabled>
        <Image
          source={{ uri: imageUri }}
          contentFit="contain"
          style={styles.image}
        />
      </Zoomable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 200,
    height: 200,
  },
});
