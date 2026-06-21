using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Account;
using WebDataContracts.ResponseModels.User;

namespace StigviddAPI.Controllers;

/// <summary>
/// Unauthenticated account lifecycle endpoints. Login itself is NOT here: the app performs
/// the Keycloak Direct Access Grant directly against Keycloak's token endpoint. This controller
/// covers the operations that require Keycloak admin privileges (provisioning, password reset).
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[AllowAnonymous]
public class AccountController : StigViddController
{
    private readonly IKeycloakAdminRepository _keycloakAdminRepository;
    private readonly IUserService _userService;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        IKeycloakAdminRepository keycloakAdminRepository,
        IUserService userService,
        ILogger<AccountController> logger)
    {
        _keycloakAdminRepository = keycloakAdminRepository;
        _userService = userService;
        _logger = logger;
    }

    /// <summary>
    /// Creates the Keycloak user and the matching StigVidd DB record. On DB failure the Keycloak
    /// user is rolled back so the two systems don't drift.
    /// </summary>
    [HttpPost]
    [Route("register")]
    public async Task<ActionResult<UserResponse?>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken ctoken)
    {
        string subjectId;
        try
        {
            subjectId = await _keycloakAdminRepository.CreateUserAsync(request.Email, request.NickName, request.Password, ctoken);
        }
        catch (KeycloakUserConflictException)
        {
            return Conflict("A user with that email already exists.");
        }

        var result = await _userService.CreateUserAsync(request.Email, request.NickName, subjectId, ctoken);

        if (!result.Success)
        {
            // Roll back the Keycloak user so a failed DB insert doesn't leave an orphaned account.
            try
            {
                await _keycloakAdminRepository.DeleteUserAsync(subjectId, ctoken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to roll back Keycloak user {SubjectId} after DB create failure.", subjectId);
            }

            if (result.Message != null)
                return ToActionResult(result.Message);

            return StatusCode(500);
        }

        if (result.Value is null)
            return StatusCode(500);

        return Created($"{result.Value.Identifier}", result.Value);
    }

    /// <summary>
    /// Triggers a Keycloak "update password" email. Always returns 204 — it never reveals whether
    /// the email belongs to a registered user.
    /// </summary>
    [HttpPost]
    [Route("forgot-password")]
    public async Task<ActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken ctoken)
    {
        try
        {
            await _keycloakAdminRepository.SendPasswordResetEmailAsync(request.Email, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password reset email.");
        }

        return NoContent();
    }
}
