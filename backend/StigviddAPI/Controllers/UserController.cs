using Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.User;
using WebDataContracts.ResponseModels.User;

namespace StigviddAPI.Controllers;

[Authorize]
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

    [HttpPost]
    [Route("create")]
    public async Task<ActionResult<UserResponse?>> CreateUserAsync([FromBody] CreateUserRequest createUserRequest,
              CancellationToken ctoken)
    {
        var result = await _userService.CreateUserAsync(createUserRequest.Email, createUserRequest.NickName, createUserRequest.FirebaseUid, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Created($"/api/v1/user/{result.Value!.Identifier}", result.Value);
    }

    [HttpGet]
    [Route("{firebaseUid}")]
    public async Task<ActionResult<UserResponse?>> GetStigViddUserByFirebaseUid(string firebaseUid, CancellationToken ctoken)
    {
        var result = await _userService.GetUserByFirebaseUidAsync(firebaseUid, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }
        return Ok(result.Value);
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

        return Created($"/api/v1/user/{favoriteRequest.UserIdentifier}/favorites/{favoriteRequest.TrailIdentifier}", result.Value);
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

        return Created($"/api/v1/user/{addToUserWishlistRequest.UserIdentifier}/wishlist/{addToUserWishlistRequest.TrailIdentifier}", result.Value);
    }

    [HttpDelete]
    [Route("/api/v1/user/{userIdentifier}/favorites/{trailIdentifier}")]
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
    [Route("/api/v1/user/{userIdentifier}/wishlist/{trailIdentifier}")]
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
