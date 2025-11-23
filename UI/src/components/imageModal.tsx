import { imageStateAtom } from "@/providers/image-atoms";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Zoomable } from "@likashefqet/react-native-image-zoom";
import { Image } from "expo-image";
import { useAtom } from "jotai";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Portal } from "react-native-paper";

const HEIGHT = Dimensions.get("screen").height;
const WIDTH = Dimensions.get("screen").width;

export default function ImageModal() {
  const [imageState, setImageState] = useAtom(imageStateAtom);

  if (!imageState.show) return null;

  const hide = () => {
    setImageState({ show: false, uri: "" });
  };

  // Helper för att hantera både string och number
  const getImageSource = () => {
    return typeof imageState.uri === "string"
      ? { uri: imageState.uri }
      : imageState.uri;
  };

  return (
    <Portal>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.overlayContainer}>
          <View style={styles.overlayBackground} />
          <View style={styles.overlayContent}>
            <TouchableOpacity style={styles.closeButton} onPress={hide}>
              <MaterialCommunityIcons
                name="close-circle-outline"
                size={32}
                color="white"
              />
            </TouchableOpacity>
            <Zoomable isDoubleTapEnabled>
              <Image
                source={getImageSource()}
                contentFit="contain"
                style={styles.fullScreenImage}
              />
            </Zoomable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Portal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000000,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(90, 90, 90, 0.95)",
  },
  overlayContent: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 10,
    padding: 5,
    backgroundColor: "#000000",
    borderRadius: 20,
    zIndex: 100001,
  },
  fullScreenImage: {
    width: WIDTH,
    height: HEIGHT,
  },
});
