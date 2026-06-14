import { ApiError } from "@/api/api-error";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Button, useTheme } from "react-native-paper";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

type ErrorInfo = {
  title: string;
  message: string;
  icon: IconName;
};

function useErrorInfo(error: unknown): ErrorInfo {
  const { t } = useTranslation();
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return { title: t("error.400.title"), message: t("error.400.message"), icon: "error-outline" };
      case 401:
        return { title: t("error.401.title"), message: t("error.401.message"), icon: "lock-outline" };
      case 403:
        return { title: t("error.403.title"), message: t("error.403.message"), icon: "block" };
      case 404:
        return { title: t("error.404.title"), message: t("error.404.message"), icon: "search-off" };
      case 500:
      case 502:
      case 503:
        return { title: t("error.500.title"), message: t("error.500.message"), icon: "cloud-off" };
    }
  }
  return { title: t("error.default.title"), message: t("error.default.message"), icon: "wifi-off" };
}

type Props = {
  error: unknown;
  onRetry?: () => void;
};

export default function ErrorView({ error, onRetry }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { title, message, icon } = useErrorInfo(error);

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <MaterialIcons name={icon} size={56} color={theme.colors.error} style={s.icon} />
      <Text style={[s.title, { color: theme.colors.onBackground }]}>{title}</Text>
      <Text style={[s.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
      {onRetry && (
        <Button mode="outlined" onPress={onRetry} style={s.button}>
          {t("error.retry")}
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
