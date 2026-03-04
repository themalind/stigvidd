import Header from "@/components/header";
import { FontAwesome, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import { useTheme } from "react-native-paper";

export default function TabsLayout() {
  const theme = useTheme();
  const pathname = usePathname();

  const shouldShowHeader = !pathname.includes("/login") && !pathname.includes("/register");

  return (
    <>
      {shouldShowHeader && <Header />}
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.outline,
          },
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
            title: "Start",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <Ionicons name="home" size={30} color={theme.colors.onTertiaryContainer} />
              ) : (
                <Ionicons name="home-outline" size={30} color={theme.colors.onBackground} />
              ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: "Karta",
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
            title: "Vandring",
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
            title: "Profil",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <MaterialCommunityIcons name="account-box" size={30} color={theme.colors.onTertiaryContainer} />
              ) : (
                <MaterialCommunityIcons name="account-box-outline" size={30} color={theme.colors.onBackground} />
              ),
          }}
        />
        <Tabs.Screen
          name="(auth)"
          options={{
            href: null,
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
