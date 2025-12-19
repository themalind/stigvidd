using Core;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace StigviddAPI.Controllers;

public abstract class StigViddController : Controller
{
    // För att alla controllers ska ha tillgång till denna metod.
    public ActionResult ToActionResult(Message message)
    {
        return message.StatusCode switch
        {
            (int)HttpStatusCode.NotFound => NotFound(message.ResultMessage),
            (int)HttpStatusCode.BadRequest => BadRequest(message.ResultMessage),
            (int)HttpStatusCode.Conflict => Conflict(message.ResultMessage),
            _ => StatusCode((int)HttpStatusCode.InternalServerError, "An unexpected error occurred.")
        };

    }
}
