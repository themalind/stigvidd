// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The per-set entry points (`@expo/vector-icons/MaterialIcons`) that react-native-paper requires
// directly for its own icons; a subpath exports the set as its default.
const React = require("react");
const { View } = require("react-native");

// Paper passes a testID of its own, usually undefined, so the spread comes first.
const Icon = ({ name, ...props }) => React.createElement(View, { ...props, testID: props.testID ?? `icon-${name}` });
Icon.displayName = "Icon";
Icon.font = {};
Icon.loadFont = jest.fn().mockResolvedValue(undefined);

module.exports = { __esModule: true, default: Icon, Icon };
