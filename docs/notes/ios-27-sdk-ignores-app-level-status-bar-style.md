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

**Fix, two parts (the first alone did NOT work; both together confirmed on device, build 17 + preview OTA, 2026-11-25):**

1. `app.json` → `expo.ios.infoPlist.UIViewControllerBasedStatusBarAppearance: true`. Native:
   needs a new EAS build, OTA cannot carry it. Check with `npx expo config --type introspect --json`.
2. The root `<Stack screenOptions={{ statusBarStyle }}>` in `app/src/app/_layout.tsx` (iOS only).
   JS, so it ships by OTA to any build that has part 1.

**Why part 1 alone fails:** `ExpoRootViewController` returns `RCTStatusBarAppearance.style` (what
JS set), but iOS never asks it. react-native-screens swizzles every `UIViewController`'s
`childViewControllerForStatusBarStyle` (`UIViewController+RNScreens.mm`) to hand the question
to its screen stack, whose top `RNSScreen` answers. With no `statusBarStyle` on any screen
that is `RNSStatusBarStyleAuto`, which follows the **system** trait
(`RNSScreenWindowTraits.mm`). The app's themes (bivack, norrsken…) are chosen in the app and
never set the native trait, so in-app dark on a light phone gave black text on black.
Nested stacks inherit the root screen's style unless they set their own.

- A React Native `Modal` follows JS (`RCTFabricModalHostViewController`), so `image-viewer.tsx`'s
  `<StatusBar style="light" />` still works there.
