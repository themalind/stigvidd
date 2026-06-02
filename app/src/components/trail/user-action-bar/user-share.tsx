import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
export default function UserShare() {
  const theme = useTheme();
  return (
    <View style={s.container}>
      <Pressable style={s.touchable}>
        <MaterialIcons name="share" size={30} color={theme.colors.onSurface} />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>Dela</Text>
      </Pressable>
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
