import { atom } from "jotai";

export const userThemeAtom = atom<"dark" | "light" | "auto">("auto");
