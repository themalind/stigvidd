// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SLIM_BUTTON_HEIGHT } from "@/constants/constants";
import { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { Button } from "react-native-paper";

export default function SlimButton({ contentStyle, labelStyle, ...props }: ComponentProps<typeof Button>) {
  return <Button {...props} contentStyle={[s.content, contentStyle]} labelStyle={[s.label, labelStyle]} />;
}

const s = StyleSheet.create({
  content: {
    height: SLIM_BUTTON_HEIGHT,
  },
  label: {
    marginVertical: 0,
  },
});
