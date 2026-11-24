<!-- SPDX-FileCopyrightText: 2026 The Stigvidd Authors -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Built with the iOS 27 SDK, the app-level status bar API does nothing: StatusBar style needs UIViewControllerBasedStatusBarAppearance YES

**Symptom (2026-11-24, iOS preview build):** status bar text was black on a black background
in dark mode, on every screen. Light mode looked right, and Android was fine.

**Why it looks like our bug and isn't:** `app/src/app/_layout.tsx` sets
`<StatusBar style={theme.dark ? "light" : "dark"} />`, and that logic is correct (Android runs
the same code). Light mode only looks right because the iOS default happens to be dark text.

**Mechanism:** Expo's prebuild writes `UIViewControllerBasedStatusBarAppearance: false`
(`@expo/config-plugins` `withIosBaseMods.js`). With that, React Native's `StatusBar` calls
the app-level `UIApplication setStatusBarStyle:`. UIKit turns that into a no-op for apps built
with the iOS 27 SDK. React Native 0.88 says so in
`node_modules/react-native/React/CoreModules/RCTStatusBarManager.mm`
(`RCTAppLevelStatusBarIsNoOp`, and the warning "StatusBar has no effect because
UIViewControllerBasedStatusBarAppearance is NO"). The warning only shows in the Xcode/device
log, never in JS.

**Fix:** `app.json` → `expo.ios.infoPlist.UIViewControllerBasedStatusBarAppearance: true`.
iOS then asks the root view controller. Since expo-modules-core 58.0.30 that is
`ExpoRootViewController`, which returns `RCTStatusBarAppearance.style`, the value JS last set.
Check the resolved plist with `npx expo config --type introspect --json`.

- It is a native change: it needs a new EAS build. An OTA update cannot carry it.
- Caveat: a react-native-screens screen presented as a native modal answers for itself with
  `RNSStatusBarStyleAuto`, which follows the **system** trait, not the app's chosen theme
  (`react-native-screens/ios/RNSScreenWindowTraits.mm`). A React Native `Modal` follows JS
  (`RCTFabricModalHostViewController`).
