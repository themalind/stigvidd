import { signOutUser } from "@/api/auth";
import { authStateAtom } from "@/atoms/auth-atoms";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import LoadingIndicator from "@/components/loading-indicator";
import ThemeToggle from "@/components/theme-toggle";
import ProfileMenuItem from "@/components/user/profile-page/profile-menu-item";
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
      <Text style={s.topTitle}>Mitt Stigvidd</Text>
      <View style={s.userInfoContainer}>
        <Image
          source={
            userTheme === "dark"
              ? require("../../assets/images/wizard-darkmode.png")
              : require("../../assets/images/wizard-lightmode.png")
          }
          style={[s.image, { borderColor: theme.colors.outline }]}
        />
        <View style={s.userProfileInfoText}>
          <Text>{user?.nickName}</Text>
          <Text>{user?.email}</Text>
        </View>
        <View style={s.themeToggleContainer}>
          <ThemeToggle />
        </View>
      </View>
      <View style={s.pressableChoicesContainer}>
        <ProfileMenuItem
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
        <ProfileMenuItem
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
        <ProfileMenuItem
          text="Skapa en promenad"
          route="/(tabs)/profile-page"
          icon={
            <MaterialIcons
              name="hiking"
              size={24}
              color={theme.colors.tertiary}
            />
          }
        />
        <ProfileMenuItem
          text="Mina egna promenader"
          route="/(tabs)/profile-page"
          icon={
            <MaterialCommunityIcons
              name="map-legend"
              size={24}
              color={theme.colors.tertiary}
            />
          }
        />
        <ProfileMenuItem
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
        <ProfileMenuItem
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
        <ProfileMenuItem
          text="Om Stigvidd"
          route="/(tabs)/(stacks)/about"
          icon={
            <MaterialIcons
              name="perm-device-info"
              size={24}
              color={theme.colors.tertiary}
            />
          }
        />
        <View style={s.accountActionsContainer}>
          <Pressable onPress={handleSignOut}>
            <Text style={s.actionText}>Logga ut</Text>
          </Pressable>
          <Pressable onPress={handleSignOut}>
            <Text style={s.actionText}>Avsluta konto</Text>
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
  topTitle: {
    fontSize: 20,
    alignSelf: "flex-start",
    paddingBottom: 10,
  },
  userInfoContainer: {
    flexDirection: "row",
    gap: 20,
    paddingBottom: 20,
  },
  image: {
    height: 80,
    width: 80,
    borderWidth: 1,
    borderRadius: 50,
  },
  userProfileInfoText: {
    flexDirection: "column",
    justifyContent: "center",
  },
  themeToggleContainer: {
    justifyContent: "space-around",
    paddingLeft: 30,
  },
  pressableChoicesContainer: {
    flexDirection: "column",
    gap: 15,
  },
  accountActionsContainer: {
    alignItems: "center",
    gap: 20,
    paddingTop: 30,
  },
  actionText: {
    textDecorationLine: "underline",
    fontSize: 16,
  },
});
