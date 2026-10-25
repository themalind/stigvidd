// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import HikeListRow from "@/components/hike/hike-list-row";
import { SharedHike } from "@/data/types";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

interface Props {
  hike: SharedHike;
  showSharedBy?: boolean;
}

export default function SharedHikeRow({ hike, showSharedBy = true }: Props) {
  const { t } = useTranslation();

  return (
    <HikeListRow
      identifier={hike.hikeIdentifier}
      name={hike.hikeName}
      coordinates={hike.coordinates}
      imageUrl={hike.images[0]?.imageUrl}
      hikeLength={hike.hikeLength}
      duration={hike.duration}
      date={hike.sharedAt}
      caption={showSharedBy ? t("hike.sharedByLabel", { name: hike.sharedByName ?? t("hike.deletedUser") }) : undefined}
      onPress={() =>
        guardedNavigate(() =>
          router.navigate({
            pathname: "/(tabs)/(profile-stack)/shared-hike/[identifier]",
            params: { identifier: hike.hikeIdentifier },
          }),
        )
      }
    />
  );
}
