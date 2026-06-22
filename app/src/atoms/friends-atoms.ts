import { getFriends, getIncomingRequests, searchUsers } from "@/api/friends";
import { getIncomingSharedHikes } from "@/api/shared-hikes";
import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import { userAtom } from "./auth-atoms";

export const incomingRequestsAtom = atomWithQuery((get) => {
  const user = get(userAtom);
  return {
    queryKey: ["friends", "incoming", user?.id],
    queryFn: () => {
      if (!user?.id) return Promise.resolve([]);
      return getIncomingRequests();
    },
    enabled: !!user?.id,
    staleTime: 0,
  };
});

export const incomingSharedHikesAtom = atomWithQuery((get) => {
  const user = get(userAtom);
  return {
    queryKey: ["shared-hikes", "incoming", user?.id],
    queryFn: () => getIncomingSharedHikes(),
    enabled: !!user?.id,
    staleTime: 0,
  };
});

export const friendsAtom = atomWithQuery((get) => {
  const user = get(userAtom);
  return {
    queryKey: ["friends", user?.id],
    queryFn: () => getFriends(),
    enabled: !!user?.id,
  };
});

export const userSearchAtomFamily = (query: string) =>
  atomWithQuery((get) => {
    const user = get(userAtom);
    return {
      queryKey: ["users", "search", user?.id, query],
      queryFn: () => searchUsers(query),
      enabled: !!user?.id && query.trim().length >= 3, // bara sök vid 3+ tecken
      staleTime: 10_000,
    };
  });

// Sum of all pending notification sources for the tab-bar badge.
// Add incomingSharesAtom here when the shared-hikes feature lands.
export const pendingNotificationsCountAtom = atom((get) => {
  const requests = get(incomingRequestsAtom).data?.length ?? 0;
  const shares = get(incomingSharedHikesAtom).data?.length ?? 0;
  return requests + shares;
});
