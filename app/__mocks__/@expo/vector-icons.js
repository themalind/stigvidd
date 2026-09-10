// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The real icon sets load their font asynchronously and setState outside act(). Each set renders
// as a View carrying its props, so `icon-<name>` names the glyph and the colour and size can be asserted.
const React = require("react");
const { View } = require("react-native");

const iconSet = (setName) => {
  const Mock = ({ name, ...props }) =>
    React.createElement(View, {
      accessibilityLabel: `${setName}/${name}`,
      ...props,
      testID: props.testID ?? `icon-${name}`,
    });
  Mock.displayName = setName;
  Mock.font = {};
  Mock.loadFont = jest.fn().mockResolvedValue(undefined);
  return Mock;
};

module.exports = {
  Entypo: iconSet("Entypo"),
  FontAwesome: iconSet("FontAwesome"),
  FontAwesome5: iconSet("FontAwesome5"),
  FontAwesome6: iconSet("FontAwesome6"),
  Fontisto: iconSet("Fontisto"),
  Ionicons: iconSet("Ionicons"),
  MaterialCommunityIcons: iconSet("MaterialCommunityIcons"),
  MaterialIcons: iconSet("MaterialIcons"),
  Octicons: iconSet("Octicons"),
  AntDesign: iconSet("AntDesign"),
  Feather: iconSet("Feather"),
  createIconSet: () => iconSet("Custom"),
};
