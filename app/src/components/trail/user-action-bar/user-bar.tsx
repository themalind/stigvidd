// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { Trail } from "@/data/types";
import { Dimensions, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import AddToUserWishlist from "./add-to-user-wishlist";
import AddToUserFavorite from "./add-user-favorite";
import UserRating from "./user-rating";
import UserReportIssue from "./user-report-issue";
import UserShare from "./user-share";

const HEIGHT = Dimensions.get("screen").height;
interface Props {
  trail: Trail;
}

export default function UserBar({ trail }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.colors.outlineVariant }]}>
      <AddToUserWishlist trailIdentifier={trail.identifier} />
      <UserShare />
      <UserRating trail={trail} />
      <UserReportIssue trailIdentifier={trail.identifier} />
      <AddToUserFavorite trailIdentifier={trail.identifier} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    height: HEIGHT * 0.08,
    borderRadius: BORDER_RADIUS,
    justifyContent: "space-between",
    alignItems: "center",
    flexDirection: "row",
    paddingLeft: 20,
    paddingRight: 20,
  },
});
