using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

public class FriendRequest
{
    public int RequesterId { get; set; }
    public int ReceiverId { get; set; }
    public FriendRequestStatus Status { get; set; } = FriendRequestStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public User? Requester { get; set; }
    public User? Receiver { get; set; }
}
