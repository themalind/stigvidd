using Core.Interfaces;
using FirebaseAdmin.Auth;

namespace Core.Services;

public class FirebaseAuthService : IFirebaseAuthService
{
    private readonly FirebaseAuth _firebaseAuth;

    public FirebaseAuthService(FirebaseAuth firebaseAuth)
    {
        _firebaseAuth = firebaseAuth;
    }

    public async Task DeleteUserAsync(string firebaseUid, CancellationToken ctoken)
    {
        await _firebaseAuth.DeleteUserAsync(firebaseUid, ctoken);
    }
}
