import Header from "@/components/header";
import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTheme } from "react-native-paper";

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <>
      <Header />
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: theme.colors.background,
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: theme.colors.onTertiaryContainer,
          tabBarInactiveTintColor: theme.colors.onBackground,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Start",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <Ionicons
                  name="home"
                  size={30}
                  color={theme.colors.onTertiaryContainer}
                />
              ) : (
                <Ionicons
                  name="home-outline"
                  size={30}
                  color={theme.colors.onBackground}
                />
              ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: "Karta",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <FontAwesome
                  name="map"
                  size={28}
                  color={theme.colors.onTertiaryContainer}
                />
              ) : (
                <FontAwesome
                  name="map-o"
                  size={25}
                  color={theme.colors.onBackground}
                />
              ),
          }}
        />
        <Tabs.Screen
          name="trails"
          options={{
            title: "Vandring",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <Ionicons
                  name="trail-sign-sharp"
                  size={30}
                  color={theme.colors.onTertiaryContainer}
                />
              ) : (
                <Ionicons
                  name="trail-sign-outline"
                  size={30}
                  color={theme.colors.onBackground}
                />
              ),
          }}
        />
        <Tabs.Screen
          name="(protected)/profile-page"
          options={{
            title: "Profil",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <MaterialCommunityIcons
                  name="account-box"
                  size={30}
                  color={theme.colors.onTertiaryContainer}
                />
              ) : (
                <MaterialCommunityIcons
                  name="account-box-outline"
                  size={30}
                  color={theme.colors.onBackground}
                />
              ),
          }}
        />

        {/* Dölj stack-screens från tabs */}
        <Tabs.Screen
          name="(stacks)"
          options={{
            href: null, // Gömmer från tabs
          }}
        />
      </Tabs>
    </>
  );
}
