// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import UserAvatar from "@/components/friends/user-avatar";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

const DEFAULT_MAX = 3;

interface Props {
  people: readonly { identifier: string; nickName: string }[];
  size?: number;
  max?: number;
}

export default function AvatarStack({ people, size = 28, max = DEFAULT_MAX }: Props) {
  const theme = useTheme();

  return (
    <View testID="avatar-stack" style={s.row}>
      {people.slice(0, max).map((p, i) => (
        <View
          key={p.identifier}
          style={[
            s.ring,
            { marginLeft: i === 0 ? 0 : -size / 3, borderColor: theme.colors.surface, borderRadius: size },
          ]}
        >
          <UserAvatar name={p.nickName} seed={p.identifier} size={size} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  ring: {
    borderWidth: 2,
  },
});
