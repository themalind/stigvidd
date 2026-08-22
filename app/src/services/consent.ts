import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * RUM analytics consent.
 *
 * Session/interaction tracking is non-essential analytics, so under GDPR plus the ePrivacy
 * rules as implemented in Sweden it needs informed, prior, OPT-IN consent — it cannot ride on
 * legitimate interest. Crash reporting and error logs are a separate question and are
 * defensible without consent, since they are necessary to keep the service working.
 *
 * "Unknown" is a real state, distinct from "declined": before the user has been asked, the
 * SDK is initialised as PENDING, which buffers without transmitting. Only an explicit grant
 * releases those events; an explicit decline discards them.
 *
 * Consent must stay as easy to withdraw as it was to give (Art. 7(3)), which is why this is a
 * plain get/set that a Settings toggle can call at any time.
 *
 * See docs/observability.md.
 */

export type ConsentState = "granted" | "denied" | "unknown";

const CONSENT_STORAGE_KEY = "@stigvidd_rum_consent";

export async function getConsent(): Promise<ConsentState> {
  try {
    const stored = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);

    return stored === "granted" || stored === "denied" ? stored : "unknown";
  } catch {
    // If we cannot read the choice we must not assume it was a yes.
    return "unknown";
  }
}

export async function setConsent(state: Exclude<ConsentState, "unknown">): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_STORAGE_KEY, state);
  } catch {
    // Persisting failed; the in-session choice still applies via the caller.
  }
}
