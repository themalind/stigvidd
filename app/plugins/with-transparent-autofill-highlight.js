// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Makes Android's autofill highlight transparent: it ignores a text field's horizontal scroll, so
// on a long autofilled email it is drawn shifted out of the field (react-native#31811).
const { AndroidConfig, withAndroidStyles } = require("expo/config-plugins");

module.exports = function withTransparentAutofillHighlight(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: "android:autofilledHighlight",
      value: "@android:color/transparent",
      targetApi: "26",
    });
    return config;
  });
};
