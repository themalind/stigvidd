import { atom } from "jotai";

type SnackbarState = {
  visible: boolean;
  message: string;
  type: "success" | "error" | "warning";
  icon?: string;
};

export const snackbarAtom = atom<SnackbarState>({
  visible: false,
  message: "",
  type: "success",
  icon: undefined,
});

// Helper atoms för att visa snackbar
export const showSuccessAtom = atom(
  null,
  (get, set, message: string, icon?: string) => {
    set(snackbarAtom, {
      visible: true,
      message,
      type: "success",
      icon: icon || "check-circle",
    });
  },
);

export const showErrorAtom = atom(
  null,
  (get, set, message: string, icon?: string) => {
    set(snackbarAtom, {
      visible: true,
      message,
      type: "error",
      icon: icon || "error-outline",
    });
  },
);

export const hideSnackbarAtom = atom(null, (get, set) => {
  set(snackbarAtom, (prev) => ({ ...prev, visible: false }));
});

export const showWarningAtom = atom(null, (get, set, message: string) => {
  set(snackbarAtom, {
    visible: true,
    message,
    type: "warning",
    icon: "warning",
  });
});
