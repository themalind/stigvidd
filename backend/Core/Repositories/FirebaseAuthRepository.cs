using Core.Interfaces.Repositories;
using FirebaseAdmin.Auth;

namespace Core.Repositories;

public class FirebaseAuthRepository : IFirebaseAuthRepository
{
    private readonly FirebaseAuth _firebaseAuth;

    public FirebaseAuthRepository(FirebaseAuth firebaseAuth)
    {
        _firebaseAuth = firebaseAuth;
    }

    public async Task DeleteUserAsync(string firebaseUid, CancellationToken ctoken)
    {
        await _firebaseAuth.DeleteUserAsync(firebaseUid, ctoken);
    }
}
