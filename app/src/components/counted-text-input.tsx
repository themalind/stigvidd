// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CharacterCount from "@/components/character-count";
import { ComponentProps } from "react";
import { TextInput } from "react-native-paper";

type Props = ComponentProps<typeof TextInput> & {
  maxLength: number;
  testID: string;
};

export default function CountedTextInput(props: Props) {
  return (
    <>
      <TextInput {...props} />
      <CharacterCount testID={`${props.testID}-count`} value={props.value} max={props.maxLength} />
    </>
  );
}
