import { userThemeAtom } from "@/atoms/user-theme-atom";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAtom } from "jotai";
import { useColorScheme } from "react-native";

export function useThemeToggle() {
  const [userTheme, setUserTheme] = useAtom(userThemeAtom);
  const colorScheme = useColorScheme();

  // The atom can be "auto", which renders as the system appearance. Toggle against
  // the theme that is actually on screen — otherwise the first tap on "auto" sets a
  // value identical to what's already shown and appears to do nothing.
  const effectiveTheme = userTheme === "auto" ? (colorScheme === "dark" ? "dark" : "light") : userTheme;

  async function toggleTheme() {
    const newTheme = effectiveTheme === "light" ? "dark" : "light";
    setUserTheme(newTheme);
    try {
      await AsyncStorage.setItem("my-theme", newTheme);
    } catch (e) {
      console.log(e);
    }
  }

  return { userTheme: effectiveTheme, toggleTheme };
}
