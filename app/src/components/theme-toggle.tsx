import { useThemeToggle } from "@/hooks/useThemeToggle";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useTheme } from "react-native-paper";

export default function ThemeToggle() {
  const { userTheme, toggleTheme } = useThemeToggle();
  const theme = useTheme();

  return (
    <Pressable onPress={toggleTheme}>
      <MaterialIcons name={userTheme === "light" ? "dark-mode" : "light-mode"} size={35} color={theme.colors.primary} />
    </Pressable>
  );
}
