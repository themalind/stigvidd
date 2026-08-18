import ShimmerBlock from "@/components/skeletons/shimmer-block";
import { BORDER_RADIUS } from "@/constants/constants";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;

export default function MapSkeleton({ text }: { text?: string }) {
  const theme = useTheme();
  return (
    <View style={s.container}>
      <ShimmerBlock
        style={{
          borderRadius: BORDER_RADIUS,
          width: WIDTH * 0.9,
          height: HEIGHT * 0.3,
        }}
      />
      {text && (
        <View style={s.overlay}>
          <Text style={[s.text, { color: theme.colors.onSurfaceVariant }]}>{text}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
