import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

export default function AddToUserList() {
  const theme = useTheme();
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.touchable}>
        <MaterialIcons name="add" size={30} color={theme.colors.onPrimary} />
        <Text style={[s.text, { color: theme.colors.onPrimary }]}>Vill gå</Text>
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
    fontSize: 12,
  },
});
