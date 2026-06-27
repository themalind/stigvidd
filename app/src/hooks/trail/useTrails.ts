import { getAllTrails } from "@/api/trails";
import { TRAIL_LIST_STALE_TIME } from "@/constants/cache";
import { TrailShortInfoResponse } from "@/data/types";
import { useQuery } from "@tanstack/react-query";

export const useTrails = () => {
  return useQuery<TrailShortInfoResponse[]>({
    queryKey: ["trailList", "trailsWithShortInfo"],
    queryFn: getAllTrails,

    staleTime: TRAIL_LIST_STALE_TIME,
    gcTime: TRAIL_LIST_STALE_TIME, // keep in cache as long as it stays fresh

    // Show cached data immediately while refetching in background
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
};
