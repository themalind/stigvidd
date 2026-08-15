import { getAllHikesByUserId } from "@/api/hikes";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import { HIKES_STALE_TIME } from "@/constants/cache";
import { Hike } from "@/data/types";
import { latestHike } from "@/utils/hike-stats";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";

export type LatestHikeState =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "empty" }
  | { kind: "hike"; hike: Hike };

// Which of the home screen's two personal cards to show: the get-started card opens the
// page, the latest-hike card sits below the carousel. Only one renders at a time.
export function useLatestHike(): LatestHikeState {
  const { isAuthenticated } = useAuth();
  const user = useAtomValue(stigviddUserAtom);

  // Query key, function and staleTime match the My hikes screen, so both share one cache
  // entry.
  const { data: hikes, isPending } = useQuery({
    queryKey: ["hikes", user.data?.identifier],
    queryFn: () => getAllHikesByUserId(user.data!.identifier),
    enabled: isAuthenticated && !!user.data,
    staleTime: HIKES_STALE_TIME,
  });

  const hike = useMemo(() => (hikes ? latestHike(hikes) : undefined), [hikes]);

  // Checked before isPending: signed-out needs no query, so the card renders on the first
  // pass instead of appearing later and pushing the page down.
  if (!isAuthenticated) return { kind: "signedOut" };
  if (isPending) return { kind: "loading" };
  return hike ? { kind: "hike", hike } : { kind: "empty" };
}
