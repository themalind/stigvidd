import { acceptFriendRequest, rejectFriendRequest, removeFriend, sendFriendRequest } from "@/api/friends";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

export function useFriendMutations() {
  const queryClient = useQueryClient();
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const setErrorMsg = useSetAtom(showErrorAtom);

  const acceptMutation = useMutation({
    mutationFn: (requesterIdentifier: string) => acceptFriendRequest(requesterIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "incoming"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setSuccessMsg("Förfrågan accepterad!");
    },
    onError: () => {
      setErrorMsg("Kunde inte godkänna, försök igen senare!");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requesterIdentifier: string) => rejectFriendRequest(requesterIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "incoming"] });
      setSuccessMsg("Förfrågan nekad");
    },
    onError: () => {
      setErrorMsg("Något gick fel, försök igen senare!");
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: (receiverNickName: string) => sendFriendRequest(receiverNickName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "outgoing"] });
      setSuccessMsg("Förfrågan skickad!");
    },
    onError: () => {
      setErrorMsg("Kunde inte skicka förfrågan, försök igen!");
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendIdentifier: string) => removeFriend(friendIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setSuccessMsg("Vän borttagen");
    },
    onError: () => {
      setErrorMsg("Kunde inte ta bort vän, försök igen senare!");
    },
  });

  return { acceptMutation, rejectMutation, sendRequestMutation, removeFriendMutation };
}
