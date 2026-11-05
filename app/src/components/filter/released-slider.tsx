// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Slider } from "@miblanchard/react-native-slider";
import { useState } from "react";
import { StyleProp, StyleSheet, TextStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  labelStyle?: StyleProp<TextStyle>;
  // One value for a plain slider, two for a range. keep-comment: the thumb count follows the array
  value: number[];
  minimumValue: number;
  maximumValue: number;
  step: number;
  label: (values: number[]) => string;
  onCommit: (values: number[]) => void;
};

// Drags live in local state and only the released value goes up, so a list is not re-filtered every frame. keep-comment: why not onValueChange
export default function ReleasedSlider({
  value,
  minimumValue,
  maximumValue,
  step,
  label,
  labelStyle,
  onCommit,
}: Props) {
  const theme = useTheme();
  const [draft, setDraft] = useState<number[] | null>(null);
  const shown = draft ?? value;

  return (
    <>
      <Text style={labelStyle ?? s.label}>{label(shown)}</Text>
      <Slider
        value={shown}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        onValueChange={setDraft}
        onSlidingComplete={(values: number[]) => {
          setDraft(null);
          onCommit(values);
        }}
        minimumTrackTintColor={theme.colors.secondary}
        maximumTrackTintColor={theme.colors.outlineVariant}
        thumbTintColor={theme.colors.primary}
        containerStyle={s.slider}
      />
    </>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 14,
    marginTop: 10,
    marginBottom: 5,
  },
  slider: {
    marginTop: 10,
  },
});
