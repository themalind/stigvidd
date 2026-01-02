using Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels;
using WebDataContracts.ResponseModels.User;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("/api/v1/[controller]")]
public class UserController : StigViddController
{
    private readonly IUserService _userService;
    private readonly ILogger<UserController> _logger;

    public UserController(IUserService userService, ILogger<UserController> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    [HttpGet]
    [Route("{userIdentifier}/favorites")]
    public async Task<ActionResult<IReadOnlyCollection<UserFavoritesTrailResponse>>> GetFavoritesByUserIdentifierAsync(
        string userIdentifier,
        CancellationToken ctoken)
    {
        var result = await _userService.GetFavoritesByUserIdentifierAsync(userIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("{userIdentifier}/wishlist")]
    public async Task<ActionResult<IReadOnlyCollection<UserWishlistTrailResponse>>> GetWishListByUserIdentifierAsync(
        string userIdentifier,
        CancellationToken ctoken)
    {
        var result = await _userService.GetWishListByUserIdentifierAsync(userIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPost]
    [Route("favorites")]
    public async Task<ActionResult<UserFavoritesTrailResponse?>> AddTrailToUserFavoritesListAsync(
       [FromBody] AddToUserFavoritesRequest favoriteRequest,
       CancellationToken ctoken)
    {
        var result = await _userService.AddTrailToUserFavoritesListAsync(favoriteRequest.UserIdentifier, favoriteRequest.TrailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Created($"/api/v1/users/{favoriteRequest.UserIdentifier}/favorites/{favoriteRequest.TrailIdentifier}", result.Value);
    }

    [HttpPost]
    [Route("wishlist")]
    public async Task<ActionResult<UserWishlistTrailResponse?>> AddTrailToUserWishListAsync(
       [FromBody] AddToUserWishlistRequest addToUserWishlistRequest,
       CancellationToken ctoken)
    {
        var result = await _userService.AddTrailToUserWishListAsync(addToUserWishlistRequest.UserIdentifier, addToUserWishlistRequest.TrailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Created($"/api/v1/users/{addToUserWishlistRequest.UserIdentifier}/wishlist/{addToUserWishlistRequest.TrailIdentifier}", result.Value);
    }

    [HttpDelete]
    [Route("/api/v1/users/{userIdentifier}/favorites/{trailIdentifier}")]
    public async Task<ActionResult> RemoveTrailFromUserFavoritesListAsync(
       [FromRoute] string userIdentifier,
       [FromRoute] string trailIdentifier,
       CancellationToken ctoken)
    {
        var result = await _userService.RemoveTrailFromUserFavoritesListAsync(userIdentifier, trailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }

    [HttpDelete]
    [Route("/api/v1/users/{userIdentifier}/wishlist/{trailIdentifier}")]
    public async Task<ActionResult> RemoveTrailFromUserWishListAsync(
       [FromRoute] string userIdentifier,
       [FromRoute] string trailIdentifier,
       CancellationToken ctoken)
    {
        var result = await _userService.RemoveTrailFromUserWishListAsync(userIdentifier, trailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}
