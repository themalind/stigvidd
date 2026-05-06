import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

export default function FilterButton() {
  const theme = useTheme();

  return (
    <Pressable style={[s.center, { backgroundColor: theme.colors.primary, borderColor: theme.colors.onPrimary }]}>
      <Ionicons name="filter" size={24} color={theme.colors.onPrimary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: {
    position: "absolute",
    right: 20,
    bottom: 50,
    padding: 12,
    borderWidth: 2,
    borderRadius: 999,
    elevation: 5,
  },
});
