import StatsHero, { HeroSatellite } from "@/components/stats-hero";
import { SharedHike } from "@/data/types";
import { formatDistanceKm } from "@/utils/format-distance";
import { summarizeSharedHikes } from "@/utils/hike-stats";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  hikes: readonly SharedHike[];
}

// Totals for the hikes shared with you. The kilometres were walked by somebody else, so
// they are labelled as distance waiting for you, and the satellites count people.
export default function SharedHikeStatsBanner({ hikes }: Props) {
  const { t } = useTranslation();
  const stats = useMemo(() => summarizeSharedHikes(hikes), [hikes]);

  const satellites: HeroSatellite[] = [
    {
      icon: "account-group",
      value: stats.senderCount.toString(),
      label: t("hike.statsSenders", { count: stats.senderCount }),
    },
  ];

  if (stats.featured) {
    satellites.push({
      icon: stats.featured.kind === "most" ? "trophy-outline" : "clock-outline",
      value: stats.featured.name,
      label: stats.featured.kind === "most" ? t("hike.statsMostFrom") : t("hike.statsLatestFrom"),
      labelFirst: true,
    });
  }

  return (
    <StatsHero
      figure={formatDistanceKm(stats.totalKm)}
      label={t("hike.statsToDiscover")}
      satellites={satellites}
    />
  );
}
