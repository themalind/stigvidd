import { getFriends, getIncomingRequests, searchUsers } from "@/api/friends";
import { atomWithQuery } from "jotai-tanstack-query";
import { userAtom } from "./auth-atoms";

export const incomingRequestsAtom = atomWithQuery((get) => {
  const firebaseUser = get(userAtom);
  return {
    queryKey: ["friends", "incoming", firebaseUser?.uid],
    queryFn: () => getIncomingRequests(),
    enabled: !!firebaseUser?.uid,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  };
});


export const friendsAtom = atomWithQuery((get) => {
  const firebaseUser = get(userAtom);
  return {
    queryKey: ["friends", firebaseUser?.uid],
    queryFn: () => getFriends(),
    enabled: !!firebaseUser?.uid,
  };
});

export const userSearchAtomFamily = (query: string) =>
  atomWithQuery(() => ({
    queryKey: ["users", "search", query],
    queryFn: () => searchUsers(query),
    enabled: query.trim().length >= 3, // bara sök vid 3+ tecken
    staleTime: 10_000,
  }));
