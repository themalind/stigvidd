using Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Review;
using WebDataContracts.ResponseModels.Review;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("/api/v1/[controller]")]
public class ReviewController : StigViddController
{
    private readonly IReviewService _reviewService;
    private readonly IUserService _userService;

    public ReviewController(IReviewService service, IUserService userService)
    {
        _reviewService = service;
        _userService = userService;
    }

    [HttpGet]
    [Route("trail/{trailIdentifier}")]
    public async Task<ActionResult<PagedReviewResponse>> GetReviewsByTrailIdentifierAsync(
        [FromRoute] string trailIdentifier,
        [FromQuery] int page, // Vilken omgång
        [FromQuery] int limit, // Hur många per omgång
        CancellationToken ctoken)
    {
        var result = await _reviewService.GetReviewsByTrailIdentifierAsync(trailIdentifier, page, limit, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost]
    [Route("create")]
    public async Task<ActionResult> AddReviewAsync(
        [FromForm] CreateReviewRequest request,
        [FromForm] IFormFileCollection? images,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _reviewService.AddReviewAsync(userResponse.Identifier, request.TrailIdentifier, request.TrailReview, request.Grade, images, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        if (result.Value == null)
        {
            return BadRequest("Review could not be created.");
        }

        return Created($"/api/v1/review/{result.Value.Identifier}", result.Value);
    }

    [Authorize]
    [HttpDelete]
    [Route("{reviewIdentifier}")]
    public async Task<ActionResult> DeleteReviewAsync(
        [FromRoute] DeleteReviewRequest request,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _reviewService.DeleteReviewAsync(
            request.ReviewIdentifier,
            userResponse.Identifier,
            ctoken
        );

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}


