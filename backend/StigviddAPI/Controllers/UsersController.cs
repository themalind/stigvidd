using Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebDataContracts.RequestModels.User;
using WebDataContracts.ResponseModels.User;

namespace StigviddAPI.Controllers;

[Authorize]
[ApiController]
[Route("/api/v1/[controller]")]
public class UsersController : StigViddController
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService, ILogger<UsersController> logger)
    {
        _userService = userService;
    }

    [HttpPost]
    [Route("create")]
    public async Task<ActionResult<UserResponse?>> CreateUser(
        [FromBody] CreateUserRequest createUserRequest,
              CancellationToken ctoken)
    {
        var firebaseUid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(firebaseUid))
        {
            return Unauthorized("Firebase UID not found in token.");
        }

        var result = await _userService.CreateUserAsync(createUserRequest.Email, createUserRequest.NickName, firebaseUid, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Created($"{result.Value!.Identifier}", result.Value);
    }

    [HttpGet]
    [Route("")]
    public async Task<ActionResult<UserResponse?>> GetStigViddUser(
       CancellationToken ctoken)
    {
        var firebaseUid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(firebaseUid))
        {
            return Unauthorized("Firebase UID not found in token.");
        }

        var result = await _userService.GetUserByFirebaseUidAsync(firebaseUid, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }
        return Ok(result.Value);
    }

    [HttpGet]
    [Route("favorites")]
    public async Task<ActionResult<IReadOnlyCollection<UserFavoritesTrailResponse>>> GetAuthenticatedUsersFavorites(
              CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userService.GetFavoritesByUserIdentifierAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("wishlist")]
    public async Task<ActionResult<IReadOnlyCollection<UserWishlistTrailResponse>>> GetAuthenticatedUsersWishList(
           CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userService.GetWishListByUserIdentifierAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPost]
    [Route("favorites")]
    public async Task<ActionResult<UserFavoritesTrailResponse?>> AddTrailToUserFavoritesList(
       [FromBody] AddToUserFavoritesRequest favoriteRequest,
       CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userService.AddTrailToUserFavoritesListAsync(userResponse.Identifier, favoriteRequest.TrailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Created($"{favoriteRequest.TrailIdentifier}", result.Value);
    }

    [HttpPost]
    [Route("wishlist")]
    public async Task<ActionResult<UserWishlistTrailResponse?>> AddTrailToUserWishList(
      [FromBody] AddToUserWishlistRequest addToUserWishlistRequest,
      CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userService.AddTrailToUserWishListAsync(userResponse.Identifier, addToUserWishlistRequest.TrailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Created($"{addToUserWishlistRequest.TrailIdentifier}", result.Value);
    }

    [HttpDelete]
    [Route("favorites/{trailIdentifier}")]
    public async Task<ActionResult> RemoveTrailFromUserFavoritesList(
      [FromRoute] RemoveFromUserFavoriteRequest request,
      CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userService.RemoveTrailFromUserFavoritesListAsync(userResponse.Identifier, request.TrailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }

    [HttpDelete]
    [Route("wishlist/{trailIdentifier}")]
    public async Task<ActionResult> RemoveTrailFromUserWishList(
      [FromRoute] RemoveFromUserwishListRequest request,
      CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userService.RemoveTrailFromUserWishListAsync(userResponse.Identifier, request.TrailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }

    [HttpDelete]
    [Route("delete")]
    public async Task<ActionResult> DeleteUser(
      CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userService.DeleteUserAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}
