import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { TouchableOpacity, View, StyleSheet, Text } from "react-native";

export default function AddToUserList() {
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.touchable}>
        <MaterialIcons name="add" size={24} color="white" />
        <Text style={s.text}>Vill gå</Text>
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
