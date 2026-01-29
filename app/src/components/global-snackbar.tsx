// components/GlobalSnackbar.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { useAtom, useSetAtom } from "jotai";
import { StyleSheet, View } from "react-native";
import { Portal, Snackbar, Text, useTheme } from "react-native-paper";
import { hideSnackbarAtom, snackbarAtom } from "../atoms/snackbar-atoms";

export function GlobalSnackbar() {
  const theme = useTheme();
  const [snackbar] = useAtom(snackbarAtom);
  const hideSnackbar = useSetAtom(hideSnackbarAtom);

  return (
    <Portal>
      <Snackbar
        visible={snackbar.visible}
        onDismiss={hideSnackbar}
        duration={3000}
        wrapperStyle={{ bottom: 50 }}
        style={{
          backgroundColor: theme.colors.secondary,
        }}
      >
        <View style={s.contentContainer}>
          {snackbar.icon && (
            <MaterialIcons
              name={snackbar.icon as any}
              size={20}
              color={theme.colors.onSecondary}
            />
          )}
          <Text style={{ color: theme.colors.onSecondary }}>
            {snackbar.message}
          </Text>
        </View>
      </Snackbar>
    </Portal>
  );
}
const s = StyleSheet.create({
  contentContainer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
