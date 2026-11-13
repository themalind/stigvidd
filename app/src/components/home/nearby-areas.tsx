// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { trailListSourceAtom } from "@/atoms/trail-list-atoms";
import AreaRow from "@/components/area/area-row";
import { HOME_AREA_ROUTES } from "@/components/area/area-routes";
import SectionPanel from "@/components/layout/section-panel";
import SeeAllLink from "@/components/layout/see-all-link";
import InlineError from "@/components/status/inline-error";
import { NEARBY_RADIUS_KM } from "@/constants/constants";
import { useAreas, usePopularAreas } from "@/hooks/area/useAreas";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

export const HOME_AREA_LIMIT = 3;

export default function NearbyAreas() {
  const { t } = useTranslation();
  const setTrailListSource = useSetAtom(trailListSourceAtom);
  const nearest = useAreas();
  const near = nearest.hasPosition
    ? (nearest.data ?? []).filter((a) => a.distanceKm != null && a.distanceKm <= NEARBY_RADIUS_KM)
    : [];
  const showNear = near.length > 0;
  const nothingNear = nearest.hasPosition && !showNear;
  const popular = usePopularAreas(nothingNear);
  const { data, isError, refetch } = nothingNear ? popular : nearest;
  const shown = (showNear ? near : (data ?? [])).slice(0, HOME_AREA_LIMIT);

  if (!data && !isError) return null;
  if (data && shown.length === 0) return null;

  const openArea = (identifier: string) =>
    guardedNavigate(() => router.navigate({ pathname: HOME_AREA_ROUTES.detail, params: { identifier } }));

  const showAll = () =>
    guardedNavigate(() => {
      setTrailListSource("areas");
      router.navigate("/(tabs)/trails");
    });

  return (
    <SectionPanel
      testID="home-areas"
      title={showNear ? t("home.areasNearYou") : t("home.areasPopular")}
      headerAction={<SeeAllLink testID="home-areas-see-all" label={t("common.seeAll")} onPress={showAll} />}
    >
      {data ? (
        <View testID="home-areas-list" style={s.list}>
          {shown.map((area) => (
            <AreaRow key={area.identifier} area={area} onPress={openArea} />
          ))}
        </View>
      ) : (
        <InlineError testID="home-areas-error" message={t("home.areasError")} onRetry={() => void refetch()} />
      )}
    </SectionPanel>
  );
}

const s = StyleSheet.create({
  list: {
    gap: 8,
  },
});
