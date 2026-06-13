using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.PushToken;

namespace StigviddAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class NotificationsController : StigViddController
{
    private readonly IPushNotificationService _pushNotificationService;
    private readonly IUserService _userService;

    public NotificationsController(IPushNotificationService pushNotificationService, IUserService userService)
    {
        _pushNotificationService = pushNotificationService;
        _userService = userService;
    }

    [HttpPost]
    [Route("tokens")]
    public async Task<ActionResult> RegisterTokenAsync(
        [FromBody] RegisterPushTokenRequest request,
        CancellationToken ctoken)
    {
        var user = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (user is null)     
            return Unauthorized();

        var result = await _pushNotificationService.RegisterTokenAsync(user.Identifier, request.ExpoToken, request.Platform, ctoken);
        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok();
    }

    [HttpDelete]
    [Route("tokens/{expoToken}")]
    public async Task<ActionResult> DeleteTokenAsync(
        [FromRoute] string expoToken,
        CancellationToken ctoken)
    {
        var user = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (user is null)
           return Unauthorized();        

        var result = await _pushNotificationService.UnregisterTokenAsync(user.Identifier, expoToken, ctoken);
        if(!result.Success && result.Message != null)     
            return ToActionResult(result.Message);   

        return Ok();
    }
}
