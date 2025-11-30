import FontAwesome from "@expo/vector-icons/FontAwesome";
import { TouchableOpacity, View, StyleSheet, Text } from "react-native";

export default function UserRating() {
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.touchable}>
        <FontAwesome name="thumbs-o-up" size={24} color="white" />
        <Text style={s.text}>Betygsätt</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "column",
  },
  touchable: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "#ffffff",
    fontSize: 12,
  },
});
