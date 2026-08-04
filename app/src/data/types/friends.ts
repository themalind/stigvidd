export interface SearchFriendResult {
  identifier: string;
  nickName: string;
}

export interface FriendResponse {
  identifier: string;
  nickName: string;
  email: string;
}

export interface FriendRequest {
  requesterIdentifier: string;
  requesterNickName: string;
  createdAt: string;
}

export interface OutgoingFriendRequest {
  receiverIdentifier: string;
  receiverNickName: string;
  createdAt: string;
}
