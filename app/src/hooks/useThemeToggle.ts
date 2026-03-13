import { userThemeAtom } from "@/atoms/user-theme-atom";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAtom } from "jotai";

export function useThemeToggle() {
  const [userTheme, setUserTheme] = useAtom(userThemeAtom);

  async function toggleTheme() {
    const newTheme = userTheme === "light" ? "dark" : "light";
    setUserTheme(newTheme);
    try {
      await AsyncStorage.setItem("my-theme", newTheme);
    } catch (e) {
      console.log(e);
    }
  }

  return { userTheme, toggleTheme };
}
