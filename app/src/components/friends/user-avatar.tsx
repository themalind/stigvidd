// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { avatarColors, initials } from "@/utils/avatar-color";
import { useMemo } from "react";
import { Avatar, useTheme } from "react-native-paper";

export const AVATAR_SIZE = 44;

interface Props {
  name: string;
  /** The user's identifier, not the nickname, so a rename keeps the colour. keep-comment: callers must not pass the name */
  seed: string;
  size?: number;
}

export default function UserAvatar({ name, seed, size = AVATAR_SIZE }: Props) {
  const theme = useTheme();
  const colors = useMemo(() => avatarColors(seed, theme.dark), [seed, theme.dark]);

  return (
    <Avatar.Text
      testID="user-avatar"
      size={size}
      label={initials(name)}
      style={{ backgroundColor: colors.background }}
      color={colors.foreground}
      labelStyle={{ fontSize: Math.round(size * 0.34), fontFamily: "Inter_600SemiBold" }}
    />
  );
}
