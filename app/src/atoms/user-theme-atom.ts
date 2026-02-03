import AsyncStorage from "@react-native-async-storage/async-storage";
import { atom } from "jotai";

export const userThemeAtom = atom<"dark" | "light" | "auto">("auto");

export const loadUserTheme = async () => {
  try {
    const theme = await AsyncStorage.getItem("my-theme");
    return (theme as "dark" | "light" | "auto") ?? "auto";
  } catch (e) {
    console.log(e);
    return "auto";
  }
};
