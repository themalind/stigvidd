import { getCoordinatesByTrailIdentifier } from "@/api/trails";
import RouteFollowView from "@/components/map/route-follow-view";
import { TRAIL_COORDINATES_STALE_TIME } from "@/constants/cache";
import { useTrailCard } from "@/hooks/useTrailCard";
import CoordinateParser from "@/utils/coordinate-parser";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

// Fullscreen "follow" view for a single trail. Reached from the carousel's "show on
// map" and by tapping the embedded map on a trail's detail screen. Pushed within the
// current stack, so back returns where you came from. All presentation lives in
// RouteFollowView, which hikes share — this file is only the trail's data path.
export default function TrailFollowScreen() {
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const normalizedIdentifier: string = Array.isArray(identifier) ? identifier[0] : identifier;

  const { card } = useTrailCard(normalizedIdentifier ?? null);

  const { data: coords, isLoading } = useQuery({
    queryKey: ["cords", normalizedIdentifier],
    queryFn: () => getCoordinatesByTrailIdentifier(normalizedIdentifier),
    enabled: !!normalizedIdentifier,
    staleTime: TRAIL_COORDINATES_STALE_TIME,
  });

  const path = useMemo(
    () => (coords ? CoordinateParser({ data: coords.coordinates, identifier: normalizedIdentifier }) : []),
    [coords, normalizedIdentifier],
  );

  return <RouteFollowView idPrefix="follow" path={path} title={card?.name} isLoading={isLoading} />;
}
