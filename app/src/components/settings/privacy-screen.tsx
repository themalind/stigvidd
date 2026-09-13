// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Switch, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getConsentSync, loadConsent, setConsent, subscribeConsent, type ConsentState } from "@/services/consent";

/**
 * Where analytics consent is withdrawn.
 *
 * Art. 7(3) requires withdrawal to be as easy as giving consent, so this is a plain switch
 * reachable in two taps from anywhere, not a buried flow. The privacy policy names this screen
 * ("Settings → Privacy" / "Inställningar → Integritet"), so it must stay findable under that
 * name in both languages.
 */
export default function PrivacyScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [consent, setConsentState] = React.useState<ConsentState>(getConsentSync());

  React.useEffect(() => {
    // Re-read rather than trusting the cache: this screen can be the first thing opened on a
    // cold start, before initTelemetry's hydration has resolved.
    void loadConsent();

    return subscribeConsent(setConsentState);
  }, []);

  async function handleToggle(next: boolean) {
    // Optimistic, so the switch never appears stuck while AsyncStorage is written. setConsent
    // publishes to the cache before it persists, for the same reason.
    setConsentState(next ? "granted" : "denied");
    await setConsent(next ? "granted" : "denied");
  }

  return (
    <ScrollView
      testID="privacy-screen"
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text variant="headlineSmall" style={[s.title, { color: theme.colors.onBackground }]}>
        {t("privacy.title")}
      </Text>

      <View style={[s.row, { backgroundColor: theme.colors.secondaryContainer }]}>
        <View style={s.rowText}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSecondaryContainer }}>
            {t("privacy.statsLabel")}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
            {t("privacy.statsDescription")}
          </Text>
        </View>
        <Switch
          testID="privacy-stats-switch"
          value={consent === "granted"}
          onValueChange={handleToggle}
          accessibilityLabel={t("privacy.statsLabel")}
        />
      </View>

      <Text variant="bodyMedium" style={[s.body, { color: theme.colors.onBackground }]}>
        {t("privacy.explanation")}
      </Text>
      <Text variant="bodySmall" style={[s.body, { color: theme.colors.onSurfaceVariant }]}>
        {t("privacy.errorsNote")}
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 16 },
  title: { fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12 },
  rowText: { flex: 1, gap: 2 },
  body: { lineHeight: 20 },
});
