import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
export default function UserShare() {
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.touchable}>
        <MaterialIcons name="share" size={25} color="white" />
        <Text style={s.text}>Dela</Text>
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
