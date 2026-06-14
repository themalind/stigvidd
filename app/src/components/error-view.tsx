import { ApiError } from "@/api/api-error";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Button, useTheme } from "react-native-paper";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

type ErrorInfo = {
  title: string;
  message: string;
  icon: IconName;
};

function getErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return { title: "Ogiltigt anrop", message: "Något gick fel med din förfrågan.", icon: "error-outline" };
      case 401:
        return { title: "Inte inloggad", message: "Du måste logga in för att fortsätta.", icon: "lock-outline" };
      case 403:
        return { title: "Åtkomst nekad", message: "Du har inte behörighet att visa detta.", icon: "block" };
      case 404:
        return { title: "Hittades inte", message: "Det du letar efter finns inte längre.", icon: "search-off" };
      case 500:
      case 502:
      case 503:
        return { title: "Serverfel", message: "Något gick fel på servern. Försök igen senare.", icon: "cloud-off" };
    }
  }
  return { title: "Något gick fel", message: "Kontrollera din internetanslutning och försök igen.", icon: "wifi-off" };
}

type Props = {
  error: unknown;
  onRetry?: () => void;
};

export default function ErrorView({ error, onRetry }: Props) {
  const theme = useTheme();
  const { title, message, icon } = getErrorInfo(error);

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <MaterialIcons name={icon} size={56} color={theme.colors.error} style={s.icon} />
      <Text style={[s.title, { color: theme.colors.onBackground }]}>{title}</Text>
      <Text style={[s.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
      {onRetry && (
        <Button mode="outlined" onPress={onRetry} style={s.button}>
          Försök igen
        </Button>
      )}
    </View>
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
