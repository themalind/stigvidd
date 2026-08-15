export const BORDER_RADIUS = 5;
export const SURFACE_BORDER_RADIUS = BORDER_RADIUS;
export const DIALOG_BORDER_RADIUS = BORDER_RADIUS;
export const SCREEN_PADDING = 10;
// White text laid over a photo or a map needs to survive whatever bright patch sits
// beneath it. Shared by the home screen's two full-bleed cards so they can't drift
// apart, and so a seasonal image swap can never reopen the legibility question.
export const OVERLAY_TEXT_SHADOW = {
  textShadowColor: "rgba(0,0,0,0.55)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;
// Permanent URL — also registered in Play Console, App Store Connect and in §9 of the
// policy itself. Never change the path.
export const PRIVACY_POLICY_URL = "https://stigvidd.se/privacy-policy/";
export const TERMS_OF_USE_URL = "https://stigvidd.se/terms-of-use/";
export const DELETE_ACCOUNT_URL = "https://stigvidd.se/delete-account/";
export const START_COORDINATE_BORAS = {
  latitude: 57.72096,
  longitude: 12.93816,
  latitudeDelta: 0.2,
  longitudeDelta: 0.1,
};
