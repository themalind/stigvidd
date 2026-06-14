import { signOutUser } from "@/api/auth";
import { authStateAtom } from "@/atoms/auth-atoms";
import { incomingRequestsAtom, incomingSharedHikesAtom } from "@/atoms/friends-atoms";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import DeleteAccountModal from "@/components/auth/delete-account-modal";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import ThemeToggle from "@/components/theme-toggle";
import ProfileMenuItem from "@/components/user/profile-page/profile-menu-item";
import { Fontisto, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { Image } from "expo-image";
import { Redirect, useFocusEffect, useNavigation } from "expo-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function ProfilePageScreen() {
  const { t } = useTranslation();
  const [{ data: user, isLoading, isError, error }] = useAtom(stigviddUserAtom);
  const setError = useSetAtom(showErrorAtom);
  const scrollViewRef = useRef<ScrollView>(null);
  const userTheme = useAtomValue(userThemeAtom);
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const [visible, setVisible] = useState(false);
  const navigation = useNavigation();
  const { data: incomingFriendRequests } = useAtomValue(incomingRequestsAtom);
  const { data: incomingSharedHikes } = useAtomValue(incomingSharedHikesAtom);
  const incomingFriendRequestCount = incomingFriendRequests?.length ?? 0;
  const incomingSharedHikeRequestCount = incomingSharedHikes?.length ?? 0;

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <ErrorView error={error} />;
  }

  async function handleSignOut() {
    try {
      await signOutUser();
    } catch (e) {
      console.log(e);
      setError(t("auth.couldNotLogout"));
    }
    navigation.getParent()?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "(auth)", state: { routes: [{ name: "login" }] } }],
      }),
    );
  }

  return (
    <ScrollView ref={scrollViewRef} contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}>
      <Text style={s.topTitle}>{t("profile.title")}</Text>
      <View style={s.userInfoContainer}>
        <Image
          source={
            userTheme === "dark"
              ? require("../../../assets/images/wizard-darkmode.png")
              : require("../../../assets/images/wizard-lightmode.png")
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
          text={t("profile.friends")}
          route="/(tabs)/(profile-stack)/user/friends"
          icon={<MaterialCommunityIcons name="account-group" size={30} color={theme.colors.onSurfaceVariant} />}
          badge={incomingFriendRequestCount}
        />
        <ProfileMenuItem
          text={t("profile.favorites")}
          route="/(tabs)/(profile-stack)/user/favorites"
          icon={<MaterialCommunityIcons name="cards-heart" size={30} color={theme.colors.onSurfaceVariant} />}
        />
        <ProfileMenuItem
          text={t("profile.wishlist")}
          route="/(tabs)/(profile-stack)/user/wishlist"
          icon={<MaterialIcons name="star" size={30} color={theme.colors.onSurfaceVariant} />}
        />
        <ProfileMenuItem
          text={t("profile.createHike")}
          route="/(tabs)/(profile-stack)/user/create-hike"
          icon={<MaterialIcons name="hiking" size={30} color={theme.colors.onSurfaceVariant} />}
        />
        <ProfileMenuItem
          text={t("profile.myHikes")}
          route="/(tabs)/(profile-stack)/user/my-hikes"
          icon={<MaterialCommunityIcons name="map-legend" size={30} color={theme.colors.onSurfaceVariant} />}
        />
        <ProfileMenuItem
          text={t("profile.sharedHikes")}
          route="/(tabs)/(profile-stack)/user/shared-hikes"
          icon={<Fontisto name="map" size={26} color={theme.colors.onSurfaceVariant} />}
          badge={incomingSharedHikeRequestCount}
        />
        <ProfileMenuItem
          text={t("profile.achievements")}
          route="/(tabs)/(profile-stack)/profile-page"
          icon={<MaterialIcons name="emoji-events" size={30} color={theme.colors.onSurfaceVariant} />}
        />
        <ProfileMenuItem
          text={t("profile.statistics")}
          route="/(tabs)/(profile-stack)/profile-page"
          icon={<MaterialIcons name="bar-chart" size={30} color={theme.colors.onSurfaceVariant} />}
        />
        <ProfileMenuItem
          text={t("profile.about")}
          route="/(tabs)/(profile-stack)/about"
          icon={<MaterialIcons name="perm-device-info" size={30} color={theme.colors.onSurfaceVariant} />}
        />
        <View style={s.accountActionsContainer}>
          <Pressable onPress={handleSignOut}>
            <Text style={s.actionText}>{t("auth.logout")}</Text>
          </Pressable>
          <Pressable onPress={() => setVisible(true)}>
            <Text style={s.actionText}>{t("profile.deleteAccount")}</Text>
          </Pressable>
        </View>
      </View>
      <DeleteAccountModal visible={visible} onDismiss={() => setVisible(false)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 10,
    gap: 10,
  },
  topTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
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
    marginLeft: "auto",
    padding: 5,
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
