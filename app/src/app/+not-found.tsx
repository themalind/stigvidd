import { router, Stack } from "expo-router";
import { useTheme, Button } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: "Sidan hittades inte" }} />
      <View style={[s.container, { backgroundColor: theme.colors.background }]}>
        <MaterialIcons name="search-off" size={56} color={theme.colors.error} style={s.icon} />
        <Text style={[s.title, { color: theme.colors.onBackground }]}>Sidan hittades inte</Text>
        <Text style={[s.message, { color: theme.colors.onSurfaceVariant }]}>Det du letar efter finns inte längre.</Text>
        <Button mode="outlined" onPress={() => router.replace("/")} style={s.button}>
          Gå till startsidan
        </Button>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  icon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: 16,
  },
});
