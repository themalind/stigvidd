import { signOutUser } from "@/api/auth";
import { authStateAtom } from "@/atoms/auth-atoms";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import LoadingIndicator from "@/components/loading-indicator";
import PressableProfileChoice from "@/components/profile-page/pressable-profile-choice";
import ThemeToggle from "@/components/theme-toggle";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function ProfilePageScreen() {
  const [{ data: user, isLoading, isError, error }] = useAtom(stigviddUserAtom);
  const setError = useSetAtom(showErrorAtom);
  const userTheme = useAtomValue(userThemeAtom);
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError && error) {
    return <Text style={{ color: theme.colors.error }}>{error.message}</Text>;
  }

  async function handleSignOut() {
    try {
      await signOutUser();
    } catch (e) {
      console.log(e);
      setError("Kunde inte logga ut.");
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
      <Text
        style={{ fontSize: 20, alignSelf: "flex-start", paddingBottom: 10 }}
      >
        Mitt Stigvidd
      </Text>
      <View
        style={{
          flexDirection: "row",
          gap: 20,
          paddingBottom: 20,
        }}
      >
        <Image
          source={
            userTheme === "dark"
              ? require("../../assets/images/wizard-lightmode.png")
              : require("../../assets/images/wizard-lightmode.png")
          }
          style={{
            height: 80,
            width: 80,
            borderColor: theme.colors.outline,
            borderWidth: 1,
            borderRadius: 50,
          }}
        />
        <View style={{ flexDirection: "column", justifyContent: "center" }}>
          <Text>{user?.nickName}</Text>
          <Text>{user?.email}</Text>
        </View>
        <View style={{ justifyContent: "space-around", paddingLeft: 30 }}>
          <ThemeToggle />
        </View>
      </View>
      <View style={{ flexDirection: "column", gap: 15 }}>
        <PressableProfileChoice
          text="Vill gå"
          route="/(tabs)/(stacks)/user/wishlist"
          icon={
            <MaterialIcons
              name="star"
              size={24}
              color={theme.colors.tertiary}
            />
          }
        />
        <PressableProfileChoice
          text="Favoriter"
          route="/(tabs)/(stacks)/user/favorites"
          icon={
            <MaterialCommunityIcons
              name="cards-heart"
              size={24}
              color={theme.colors.tertiary}
            />
          }
        />
        <PressableProfileChoice
          text="Utmärkelser"
          route="/(tabs)/profile-page"
          icon={
            <MaterialIcons
              name="emoji-events"
              size={24}
              color={theme.colors.tertiary}
            />
          }
        />
        <PressableProfileChoice
          text="Statistik"
          route="/(tabs)/profile-page"
          icon={
            <MaterialIcons
              name="bar-chart"
              size={24}
              color={theme.colors.tertiary}
            />
          }
        />
        <View style={{ alignItems: "center", gap: 20, paddingTop: 30 }}>
          <Pressable onPress={handleSignOut}>
            <Text style={{ textDecorationLine: "underline", fontSize: 16 }}>
              Logga ut
            </Text>
          </Pressable>
          <Pressable onPress={handleSignOut}>
            <Text style={{ textDecorationLine: "underline", fontSize: 16 }}>
              Avsluta konto
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    gap: 10,
  },
});
