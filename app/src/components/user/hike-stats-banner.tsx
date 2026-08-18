import StatsHero, { HeroSatellite } from "@/components/stats-hero";
import { Hike } from "@/data/types";
import { formatDistanceKm } from "@/utils/format-distance";
import { formatTotalDuration, summarizeHikes } from "@/utils/hike-stats";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  hikes: readonly Hike[];
}

// Totals for the whole collection, above the list they summarise. Takes the unfiltered
// hikes — the header's "showing x of y" counter is what tracks filtering.
export default function HikeStatsBanner({ hikes }: Props) {
  const { t } = useTranslation();
  const stats = useMemo(() => summarizeHikes(hikes), [hikes]);

  const satellites: HeroSatellite[] = [
    { icon: "hiking", value: stats.count.toString(), label: t("hike.statsCount", { count: stats.count }) },
    { icon: "clock-outline", value: formatTotalDuration(stats.totalMs), label: t("hike.statsTime") },
  ];

  return (
    <StatsHero figure={formatDistanceKm(stats.totalKm)} label={t("hike.statsTotalWalked")} satellites={satellites} />
  );
}
