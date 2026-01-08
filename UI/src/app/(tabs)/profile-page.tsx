import { signOutUser } from "@/api/auth";
import { authStateAtom } from "@/providers/auth-atoms";
import { stigviddUserAtom } from "@/providers/user-atoms";
import { userThemeAtom } from "@/providers/user-theme-atom";
import { Link, Redirect, router } from "expo-router";
import { useAtom } from "jotai";
import { ScrollView, StyleSheet } from "react-native";
import { Button, SegmentedButtons, Text, useTheme } from "react-native-paper";

export default function ProfilePageScreen() {
  const [userTheme, setUserTheme] = useAtom(userThemeAtom);
  const [{ data }] = useAtom(stigviddUserAtom);
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);

  // Fixa så man inte måste avsluta appen när man ångrar sig och inte vill logga in efter man tryckt på profilpage
  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  async function handleSignOut() {
    try {
      await signOutUser();
    } catch (e) {
      console.log(e);
    }
    router.replace("/(tabs)");
  }

  return (
    <ScrollView
      contentContainerStyle={[
        s.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text>Inloggad som:</Text>
      <Text>{data?.nickName}</Text>
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
      <Link href="../(stacks)/user/favorites">
        <Button mode="contained">Favorites</Button>
      </Link>
      <Link href="../(stacks)/user/wishlist">
        <Button mode="contained">Wishlist</Button>
      </Link>
      <Link href="../../(auth)/login">
        <Button mode="contained">Login</Button>
      </Link>
      <Link href="../../(auth)/register">
        <Button mode="contained">Register</Button>
      </Link>

      <Button mode="contained" onPress={handleSignOut}>
        Logga ut
      </Button>
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
