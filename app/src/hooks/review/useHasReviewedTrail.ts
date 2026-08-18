import { hasReviewedTrail } from "@/api/reviews";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";

// Keyed per user so the next signed-in user does not inherit this answer.
export const hasReviewedTrailKey = (trailIdentifier: string, userIdentifier?: string) => [
  "review-exists",
  trailIdentifier,
  userIdentifier,
];

// True when the user already has a review on the trail.
export function useHasReviewedTrail(trailIdentifier: string) {
  const { isAuthenticated } = useAuth();
  const { data: stigviddUser } = useAtomValue(stigviddUserAtom);

  return useQuery({
    queryKey: hasReviewedTrailKey(trailIdentifier, stigviddUser?.identifier),
    queryFn: () => hasReviewedTrail(trailIdentifier),
    enabled: isAuthenticated && !!stigviddUser?.identifier,
  });
}
