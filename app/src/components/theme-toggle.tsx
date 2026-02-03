import { userThemeAtom } from "@/atoms/user-theme-atom";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAtom } from "jotai";
import { Pressable } from "react-native";
import { useTheme } from "react-native-paper";

export default function ThemeToggle() {
  const [userTheme, setUserTheme] = useAtom(userThemeAtom);
  const theme = useTheme();

  const toggleTheme = async () => {
    const newTheme = userTheme === "light" ? "dark" : "light";
    setUserTheme(newTheme);

    try {
      await AsyncStorage.setItem("my-theme", newTheme);
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <Pressable onPress={toggleTheme}>
      <MaterialIcons name={userTheme === "light" ? "dark-mode" : "light-mode"} size={35} color={theme.colors.primary} />
    </Pressable>
  );
}
