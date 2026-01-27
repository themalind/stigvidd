export type SnackbarState = {
  visible: boolean;
  message: string;
  type: "success" | "error" | "warning";
  icon?: string;
};
