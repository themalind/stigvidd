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
    private readonly IReviewService _service;

    public ReviewController(IReviewService service)
    {
        _service = service;
    }

    [HttpGet]
    [Route("trail/{trailIdentifier}")]
    public async Task<ActionResult<IReadOnlyCollection<ReviewResponse>>> GetReviewsByTrailIdentifierAsync(
        [FromRoute] string trailIdentifier,
        CancellationToken ctoken)
    {
        var result = await _service.GetReviewsByTrailIdentifierAsync(trailIdentifier, ctoken);

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

        var result = await _service.AddReviewAsync(request.UserIdentifier, request.TrailIdentifier, request.TrailReview, request.Grade, images, ctoken);

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
}

    
