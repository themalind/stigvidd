// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import HikeListRow from "@/components/hike/hike-list-row";
import { SentShare } from "@/utils/outgoing-shares";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";

export default function SentShareRow({ share }: { share: SentShare }) {
  const { hike } = share;

  return (
    <HikeListRow
      testID="sent-share-row"
      identifier={hike.hikeIdentifier}
      name={hike.hikeName}
      coordinates={hike.coordinates}
      imageUrl={hike.imageUrl}
      hikeLength={hike.hikeLength}
      duration={hike.duration}
      date={share.sharedAt}
      onPress={() =>
        guardedNavigate(() =>
          router.navigate({
            pathname: hike.isOwnHike
              ? "/(tabs)/(profile-stack)/hike/[identifier]"
              : "/(tabs)/(profile-stack)/shared-hike/[identifier]",
            params: { identifier: hike.hikeIdentifier },
          }),
        )
      }
    />
  );
}
