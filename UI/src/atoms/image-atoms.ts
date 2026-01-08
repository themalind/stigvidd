import { atom, useSetAtom } from "jotai";

// Jotai atoms
export const imageStateAtom = atom<{
  show: boolean;
  uri: string | number;
}>({
  show: false,
  uri: "",
});

// Derived atom för att visa bild
export const showImageAtom = atom(
  null,
  (get, set, imageUri: string | number) => {
    set(imageStateAtom, { show: true, uri: imageUri });
  },
);

// Derived atom för att dölja bild
export const hideImageAtom = atom(null, (get, set) => {
  set(imageStateAtom, { show: false, uri: "" });
});

export function useImage() {
  const showImage = useSetAtom(showImageAtom);
  return { showImage };
}
