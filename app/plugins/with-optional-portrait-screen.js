// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Declares android.hardware.screen.portrait optional: "orientation": "portrait" implies it as
// required, and Google Play then refuses the release for tablets, desktops and XR.
const { withAndroidManifest } = require("expo/config-plugins");

const FEATURE = "android.hardware.screen.portrait";

module.exports = function withOptionalPortraitScreen(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const features = (manifest["uses-feature"] ?? []).filter((f) => f.$["android:name"] !== FEATURE);
    features.push({ $: { "android:name": FEATURE, "android:required": "false" } });
    manifest["uses-feature"] = features;
    return config;
  });
};
