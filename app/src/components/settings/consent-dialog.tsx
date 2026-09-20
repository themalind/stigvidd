// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import React from "react";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import { track } from "@/services/analytics";
import { getConsentSync, isConsentHydrated, setConsent, subscribeConsent, type ConsentState } from "@/services/consent";

/**
 * Asks for analytics consent, once.
 *
 * Consent must be FREELY GIVEN, which is a constraint on the presentation and not only on the
 * wording: the two buttons are the same kind, the same size and the same colour, in the
 * reading order accept-then-decline, with nothing pre-selected. A styled-up "Yes" beside a
 * greyed-out "No" is the single most common finding against a consent dialog, and it would
 * make the consent invalid rather than merely ugly.
 *
 * It is also not dismissible by tapping outside: an accidental dismissal is not a decision,
 * and treating it as one in either direction would be wrong. Unanswered stays "unknown", which
 * holds events without transmitting them.
 *
 * Rendered inside the layout's provider tree beside GlobalSnackbar. It waits for hydration —
 * without that, a returning user who already answered would be asked again on every launch,
 * because the consent cache reads "unknown" for the moment before the stored value lands.
 */
export function ConsentDialog() {
  const { t } = useTranslation();
  const [consent, setConsentState] = React.useState<ConsentState>(getConsentSync());
  const [hydrated, setHydrated] = React.useState(isConsentHydrated());

  React.useEffect(() => {
    // subscribeConsent fires on hydration too, which is what flips `hydrated` below.
    return subscribeConsent((next) => {
      setConsentState(next);
      setHydrated(isConsentHydrated());
    });
  }, []);

  async function choose(granted: boolean) {
    setConsentState(granted ? "granted" : "denied");
    await setConsent(granted ? "granted" : "denied");

    // Recorded only on a grant. There is deliberately no event for a decline: transmitting
    // "I do not consent to events" would be self-contradictory. See event-catalogue.ts.
    if (granted) track("consent.granted", {});
  }

  if (!hydrated || consent !== "unknown") return null;

  return (
    <Portal>
      <Dialog style={{ borderRadius: DIALOG_BORDER_RADIUS }} visible dismissable={false} testID="consent-dialog">
        <Dialog.Title>{t("privacy.askTitle")}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{t("privacy.askBody")}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="consent-accept" onPress={() => void choose(true)}>
            {t("privacy.accept")}
          </Button>
          <Button testID="consent-decline" onPress={() => void choose(false)}>
            {t("privacy.decline")}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
