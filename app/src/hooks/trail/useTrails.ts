import { getAllTrails } from "@/api/trails";
import { TrailShortInfoResponse } from "@/data/types";
import { useQuery } from "@tanstack/react-query";

export const useTrails = () => {
  return useQuery<TrailShortInfoResponse[]>({
    queryKey: ["trailList", "trailsWithShortInfo"],
    queryFn: getAllTrails,

    // Cache for 24 hours
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours

    // Show cached data immediately while refetching in background
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
};
