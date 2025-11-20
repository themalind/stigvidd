import { userThemeAtom } from "@/providers/user-theme-atom";
import { Link } from "expo-router";
import { useAtom } from "jotai";
import { Text, View } from "react-native";
import { SegmentedButtons, Button } from "react-native-paper";

export default function ProfilePageScreen() {
  const [userTheme, setUserTheme] = useAtom(userThemeAtom);

  return (
    <View>
      <Text>Profilsida</Text>
      <SegmentedButtons
        value={userTheme}
        onValueChange={setUserTheme}
        buttons={[
          {
            value: "light",
            label: "Light",
          },
          {
            value: "dark",
            label: "Dark",
          },
          { value: "auto", label: "Auto" },
        ]}
      />
      <Link href="../../(auth)/register">
        <Button mode="contained">Register</Button>
      </Link>
      <Link href="../../(auth)/login">
        <Button mode="contained">Login</Button>
      </Link>
    </View>
  );
}
