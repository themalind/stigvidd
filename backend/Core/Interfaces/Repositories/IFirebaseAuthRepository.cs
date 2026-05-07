namespace Core.Interfaces.Repositories;

public interface IFirebaseAuthRepository
{
    Task DeleteUserAsync(string firebaseUid, CancellationToken ctoken);
}
