import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Platform, Pressable, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

export default function BackButton() {
  const theme = useTheme();

  if (Platform.OS !== "ios") return null;

  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={s.button}>
      <MaterialIcons name="chevron-left" size={32} color={theme.colors.onBackground} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    paddingLeft: 4,
    paddingTop: 8,
  },
});
