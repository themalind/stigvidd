import { userThemeAtom } from "@/providers/user-theme-atom";
import { Link } from "expo-router";
import { useAtom } from "jotai";
import { ScrollView, StyleSheet } from "react-native";
import { Button, SegmentedButtons, useTheme } from "react-native-paper";

export default function ProfilePageScreen() {
  const [userTheme, setUserTheme] = useAtom(userThemeAtom);
  const theme = useTheme();
  return (
    <ScrollView
      contentContainerStyle={[
        s.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <SegmentedButtons
        value={userTheme}
        onValueChange={setUserTheme}
        buttons={[
          {
            value: "light",
            label: "Light",
            labelStyle: { color: theme.colors.onBackground },
          },
          {
            value: "dark",
            label: "Dark",
            labelStyle: { color: theme.colors.onBackground },
          },
          {
            value: "auto",
            label: "Auto",
            labelStyle: { color: theme.colors.onBackground },
          },
        ]}
      />
      <Link href="../../(auth)/register">
        <Button mode="contained">Register</Button>
      </Link>
      <Link href="../../(auth)/login">
        <Button mode="contained">Login</Button>
      </Link>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 10,
  },
});
