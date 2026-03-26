import { signOutUser } from "@/api/auth";
import { authStateAtom } from "@/atoms/auth-atoms";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useAtom, useSetAtom } from "jotai";
import * as React from "react";
import { Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import { Divider, Drawer, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const width = Dimensions.get("screen").width;

export default function SettingsDrawer({ visible, onDismiss }: Props) {
  const [authState] = useAtom(authStateAtom);
  const { userTheme, toggleTheme } = useThemeToggle();
  const theme = useTheme();
  const setError = useSetAtom(showErrorAtom);
  const [active, setActive] = React.useState("");
  const insets = useSafeAreaInsets();

  async function handleThemeToggle() {
    setActive("theme");
    await toggleTheme();
  }

  function handleAbout() {
    setActive("about");
    onDismiss();
    router.replace("/(tabs)/(settings)/about");
  }

  async function handleSignOut() {
    setActive("logout");
    try {
      await signOutUser();
    } catch (e) {
      console.log(e);
      setError("Kunde inte logga ut.");
    }
    onDismiss();
    router.replace("/(tabs)/(settings)/login");
  }

  function handleLogin() {
    setActive("login");
    onDismiss();
    router.replace("/(tabs)/(settings)/login");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={s.backdrop} onPress={onDismiss}>
        <BlurView intensity={80} tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View
        style={[
          s.panel,
          {
            backgroundColor: theme.colors.surface,
            borderLeftColor: theme.colors.outlineVariant,
            borderLeftWidth: 1,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <View style={s.stigviddContainer}>
          <Image style={s.image} contentFit="contain" source={require("../../assets/images/mammaapp.png")} />
          <Text style={[s.text, { color: theme.colors.onSurfaceVariant }]}>Stigvidd</Text>
          <Pressable hitSlop={12} onPress={onDismiss} style={s.closeButton}>
            <MaterialIcons name="close" size={24} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>
        <View style={s.drawerItemContainer}>
          <Divider bold style={{ marginHorizontal: 16 }} />
          <Drawer.Section showDivider={false} style={s.drawerSection}>
            <Drawer.Item
              label="Tema"
              icon="theme-light-dark"
              active={active === "theme"}
              theme={{ roundness: 1 }}
              right={() => (
                <MaterialIcons
                  name={userTheme === "light" ? "dark-mode" : "light-mode"}
                  size={24}
                  color={active === "theme" ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant}
                />
              )}
              onPress={handleThemeToggle}
            />
            <Drawer.Item
              label="Om Stigvidd"
              icon="cellphone-information"
              active={active === "about"}
              theme={{ roundness: 1 }}
              onPress={handleAbout}
            />
            {authState.isAuthenticated ? (
              <Drawer.Item
                label="Logga ut"
                icon="logout"
                active={active === "logout"}
                theme={{ roundness: 1 }}
                onPress={handleSignOut}
              />
            ) : (
              <Drawer.Item
                label="Logga in"
                icon="login"
                active={active === "login"}
                theme={{ roundness: 1 }}
                onPress={handleLogin}
              />
            )}
          </Drawer.Section>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: width * 0.7,
    paddingTop: 0,
    elevation: 8,
  },
  stigviddContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 12,
  },
  closeButton: {
    marginLeft: "auto",
  },
  text: {
    fontSize: 20,
    fontWeight: 700,
  },
  image: {
    height: 60,
    width: 60,
    alignSelf: "center",
  },
  drawerItemContainer: {
    marginTop: "auto",
    paddingBottom: 45,
  },
  drawerSection: {
    marginTop: 20,
  },
});
