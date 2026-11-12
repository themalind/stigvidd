// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { trailListSourceAtom } from "@/atoms/trail-list-atoms";
import ContributionCard from "@/components/home/contribution-card";
import PanelCarousel from "@/components/layout/panel-carousel";
import SectionPanel from "@/components/layout/section-panel";
import SeeAllLink from "@/components/layout/see-all-link";
import ContributionInfo from "@/components/trail/contribution-info";
import { usePopularContributions } from "@/hooks/trail/usePopularContributions";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

export const HOME_CONTRIBUTION_LIMIT = 5;

interface Props {
  latitude?: number;
  longitude?: number;
  // keep-comment: false while the position is still resolving, so the query fires once rather than again with coordinates
  enabled?: boolean;
}

// keep-comment: with no walk nearby it falls back to the nationwide list; renders nothing only when there are no published walks at all
export default function PopularContributions({ latitude, longitude, enabled = true }: Props) {
  const { t } = useTranslation();
  const setTrailListSource = useSetAtom(trailListSourceAtom);
  const { data, showNearby } = usePopularContributions(latitude, longitude, enabled);

  if (!data || data.length === 0) return null;

  const openTrail = (identifier: string) =>
    guardedNavigate(() => router.navigate({ pathname: "/(tabs)/(home)/trail/[identifier]", params: { identifier } }));

  const showAll = () =>
    guardedNavigate(() => {
      setTrailListSource("contributions");
      router.navigate("/(tabs)/trails");
    });

  return (
    <SectionPanel
      testID="home-popular-contributions"
      title={showNearby ? t("home.popularContributionsNearYou") : t("home.popularContributions")}
      subtitle={t("home.popularContributionsHint")}
      titleAccessory={<ContributionInfo testID="home-contribution-info" />}
      headerAction={<SeeAllLink testID="home-contributions-see-all" label={t("common.seeAll")} onPress={showAll} />}
    >
      <PanelCarousel testID="home-contributions-row">
        {data.slice(0, HOME_CONTRIBUTION_LIMIT).map((trail) => (
          <ContributionCard
            key={trail.identifier}
            testID={`home-contribution-${trail.identifier}`}
            trail={trail}
            onPress={openTrail}
          />
        ))}
      </PanelCarousel>
    </SectionPanel>
  );
}
