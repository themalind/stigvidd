namespace Core.Interfaces;

public interface IFirebaseAuthService
{
    Task DeleteUserAsync(string firebaseUid, CancellationToken ctoken);
}
