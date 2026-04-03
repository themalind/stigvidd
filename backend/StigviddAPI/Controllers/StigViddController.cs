using Core;
using Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Security.Claims;
using WebDataContracts.ResponseModels.User;

namespace StigviddAPI.Controllers;

public abstract class StigViddController : Controller
{
    protected ActionResult ToActionResult(Message message)
    {
        return message.StatusCode switch
        {
            (int)HttpStatusCode.NotFound => NotFound(message.ResultMessage),
            (int)HttpStatusCode.BadRequest => BadRequest(message.ResultMessage),
            (int)HttpStatusCode.Conflict => Conflict(message.ResultMessage),
            (int)HttpStatusCode.Unauthorized => Unauthorized(message.ResultMessage),
            _ => StatusCode(StatusCodes.Status500InternalServerError)
        };

    }

    protected async Task<UserResponse?> GetAuthenticatedUserAsync(
        IUserService userService,
        CancellationToken ctoken)
    {
        var firebaseUid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(firebaseUid))
        {
            return null;
        }

        var userResult = await userService.GetUserByFirebaseUidAsync(firebaseUid, ctoken);

        return userResult?.Value;
    }
}
