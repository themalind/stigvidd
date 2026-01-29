import { userThemeAtom } from "@/atoms/user-theme-atom";
import { MaterialIcons } from "@expo/vector-icons";
import { useAtom } from "jotai";
import { Pressable } from "react-native";
import { useTheme } from "react-native-paper";

export default function ThemeToggle() {
  const [userTheme, setUserTheme] = useAtom(userThemeAtom);
  const theme = useTheme();

  const toggleTheme = () => {
    setUserTheme(userTheme === "light" ? "dark" : "light");
  };

  return (
    <Pressable onPress={toggleTheme}>
      <MaterialIcons
        name={userTheme === "light" ? "dark-mode" : "light-mode"}
        size={35}
        color={theme.colors.primary}
      />
    </Pressable>
  );
}
