// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Linking, StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { useTranslation } from "react-i18next";

interface Props {
  style?: StyleProp<TextStyle>;
  linkColor: string;
}

export default function BanContactText({ style, linkColor }: Props) {
  const { t } = useTranslation();
  const email = t("about.contactEmail");

  return (
    <Text style={style}>
      {t("ban.contact")}{" "}
      <Text
        accessibilityRole="link"
        style={[s.link, { color: linkColor }]}
        onPress={() => Linking.openURL(`mailto:${email}`).catch(() => undefined)}
      >
        {email}
      </Text>
      .
    </Text>
  );
}

const s = StyleSheet.create({
  link: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
