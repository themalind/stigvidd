// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import React from "react";
import { useTranslation } from "react-i18next";

import DialogFrame from "@/components/dialog/dialog-frame";
import { DialogText } from "@/components/dialog/dialog-section";
import { track } from "@/services/analytics";
import { getConsentSync, isConsentHydrated, setConsent, subscribeConsent, type ConsentState } from "@/services/consent";

// keep-comment: GDPR "freely given": both buttons alike in kind, size and colour, nothing pre-selected
// keep-comment: not dismissable by tapping outside; unanswered stays "unknown", which holds events unsent
// keep-comment: never mention location: App Review rejects text before the prompt whose buttons are not "Continue"
// keep-comment: waits for hydration, or a returning user is asked again on every launch
export function ConsentDialog() {
  const { t } = useTranslation();
  const [consent, setConsentState] = React.useState<ConsentState>(getConsentSync());
  const [hydrated, setHydrated] = React.useState(isConsentHydrated());

  React.useEffect(() => {
    // keep-comment: it also fires on hydration, which flips `hydrated`
    return subscribeConsent((next) => {
      setConsentState(next);
      setHydrated(isConsentHydrated());
    });
  }, []);

  async function choose(granted: boolean) {
    setConsentState(granted ? "granted" : "denied");
    await setConsent(granted ? "granted" : "denied");

    // keep-comment: no event for a decline, which would send data about refusing to send data
    if (granted) track("consent.granted", {});
  }

  if (!hydrated || consent !== "unknown") return null;

  return (
    <DialogFrame
      testID="consent-dialog"
      visible
      dismissable={false}
      onDismiss={() => undefined}
      title={t("privacy.askTitle")}
      icon="shield-check-outline"
      actions={[
        { label: t("privacy.accept"), onPress: () => void choose(true), testID: "consent-accept" },
        { label: t("privacy.decline"), onPress: () => void choose(false), testID: "consent-decline" },
      ]}
    >
      <DialogText>{t("privacy.askBody")}</DialogText>
    </DialogFrame>
  );
}
