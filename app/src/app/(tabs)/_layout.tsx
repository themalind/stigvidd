import { pendingNotificationsCountAtom } from "@/atoms/friends-atoms";
import Header from "@/components/header";
import { FontAwesome, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, usePathname, useSegments } from "expo-router";
import { useAtomValue } from "jotai";
import { View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const { isAuthenticated } = useAuth();
  const incomingCount = useAtomValue(pendingNotificationsCountAtom);

  // On the profile tab, login/register live inside the stack and Stack.Protected
  // swaps them in/out imperatively when auth flips — usePathname() lags one
  // transition behind that swap, so deriving header visibility from the leaf path
  // here is unreliable. The tab segment "(profile-stack)" is stable across the
  // flip (you never leave the tab) and isAuthenticated is the lag-free source of
  // truth for which screen Protected shows, so use that on the profile tab.
  // Other tabs (incl. the separate settings login) keep the pathname check.
  const onProfileTab = segments.includes("(profile-stack)");
  const shouldShowHeader = onProfileTab
    ? isAuthenticated
    : !pathname.includes("/login") && !pathname.includes("/register");

  return (
    <>
      {shouldShowHeader && <Header />}
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: theme.dark ? "#000000" : "#ffffff",
            borderTopColor: theme.colors.outline,
          },
          tabBarBackground: () => <View style={{ flex: 1, backgroundColor: theme.dark ? "#000000" : "#ffffff" }} />,
          tabBarIconStyle: {
            marginTop: 8,
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: theme.colors.onTertiaryContainer,
          tabBarInactiveTintColor: theme.colors.onBackground,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: t("tabs.home"),
            tabBarIcon: ({ focused }) =>
              focused ? (
                <Ionicons name="home" size={30} color={theme.colors.onTertiaryContainer} />
              ) : (
                <Ionicons name="home-outline" size={30} color={theme.colors.onBackground} />
              ),
          }}
        />
        <Tabs.Screen
          name="(map)"
          options={{
            title: t("tabs.map"),
            tabBarIcon: ({ focused }) =>
              focused ? (
                <FontAwesome name="map" size={28} color={theme.colors.onTertiaryContainer} />
              ) : (
                <FontAwesome name="map-o" size={25} color={theme.colors.onBackground} />
              ),
          }}
        />
        <Tabs.Screen
          name="(trails-tab)"
          options={{
            title: t("tabs.trails"),
            tabBarIcon: ({ focused }) =>
              focused ? (
                <Ionicons name="trail-sign-sharp" size={30} color={theme.colors.onTertiaryContainer} />
              ) : (
                <Ionicons name="trail-sign-outline" size={30} color={theme.colors.onBackground} />
              ),
          }}
        />
        <Tabs.Screen
          name="(profile-stack)"
          options={{
            title: t("tabs.profile"),
            tabBarIcon: ({ focused }) =>
              focused ? (
                <MaterialCommunityIcons name="account-box" size={30} color={theme.colors.onTertiaryContainer} />
              ) : (
                <MaterialCommunityIcons name="account-box-outline" size={30} color={theme.colors.onBackground} />
              ),
            tabBarBadge: incomingCount > 0 ? incomingCount : undefined,
            tabBarBadgeStyle: { color: theme.colors.onTertiary, backgroundColor: theme.colors.tertiary },
          }}
        />
        <Tabs.Screen
          name="(settings)"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}
