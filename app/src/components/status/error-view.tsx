// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/core/api-error";
import { isUnauthorized } from "@/api/core/unauthorized";
import { useAuth } from "@/components/auth/auth-provider";
import { BORDER_RADIUS } from "@/constants/constants";
import { useIsOnline } from "@/hooks/useIsOnline";
import { isFetchFailure } from "@/services/fetch-failure";
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

// keep-comment: compared by name, since a test that mocks keycloak-auth leaves SessionUnavailableError undefined
const CONNECTION_ERROR_NAMES = new Set(["TimeoutError", "SessionUnavailableError"]);

function isConnectionFailure(error: unknown): boolean {
  return isFetchFailure(error) || (error instanceof Error && CONNECTION_ERROR_NAMES.has(error.name));
}

function useErrorInfo(error: unknown, crashed: boolean): ErrorInfo {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  // keep-comment: a render crash is a bug, so neither the connection nor waiting for it will fix it
  if (crashed) return { title: t("error.default.title"), message: t("error.default.message"), icon: "error-outline" };
  if (error instanceof ApiError && error.status !== undefined) {
    const status = error.status;
    if (status === 400) return { title: t("error.400.title"), message: t("error.400.message"), icon: "error-outline" };
    if (status === 401) return { title: t("error.401.title"), message: t("error.401.message"), icon: "lock-outline" };
    if (status === 403) return { title: t("error.403.title"), message: t("error.403.message"), icon: "block" };
    if (status === 404) return { title: t("error.404.title"), message: t("error.404.message"), icon: "search-off" };
    if (status === 429)
      return { title: t("error.429.title"), message: t("error.429.message"), icon: "hourglass-empty" };
    if (status >= 500) return { title: t("error.500.title"), message: t("error.500.message"), icon: "cloud-off" };
  }
  // The request never reached the server; the reconnect refetches it. keep-comment: why offline gets no retry button of its own
  if (!isOnline) return { title: t("error.offline.title"), message: t("error.offline.message"), icon: "cloud-off" };
  if (isConnectionFailure(error)) {
    return { title: t("error.connection.title"), message: t("error.connection.message"), icon: "wifi-off" };
  }
  return { title: t("error.default.title"), message: t("error.default.message"), icon: "error-outline" };
}

type Props = {
  error: unknown;
  onRetry?: () => void;
  crashed?: boolean;
  onBackToStart?: () => void;
};

export default function ErrorView({ error, onRetry, crashed = false, onBackToStart }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { title, message, icon } = useErrorInfo(error, crashed);
  const { isAuthenticated, logout } = useAuth();

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <MaterialIcons name={icon} size={56} color={theme.colors.error} style={s.icon} />
      <Text style={[s.title, { color: theme.colors.onBackground }]}>{title}</Text>
      <Text style={[s.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
      {isAuthenticated && isUnauthorized(error) && (
        <Button mode="contained" onPress={() => void logout()} style={s.button}>
          {t("error.401.relogin")}
        </Button>
      )}
      {onRetry && (
        <Button mode="outlined" onPress={onRetry} style={s.button}>
          {t("error.retry")}
        </Button>
      )}
      {onBackToStart && (
        <Button mode="text" onPress={onBackToStart}>
          {t("error.backToStart")}
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
    borderRadius: BORDER_RADIUS,
  },
});
