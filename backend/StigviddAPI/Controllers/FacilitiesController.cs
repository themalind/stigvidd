using Core.Interfaces.Services;
using Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.RequestModels.Media;
using WebDataContracts.ResponseModels.Facility;

namespace StigviddAPI.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class FacilitiesController : StigViddController
    {
        private readonly IFacilityService _facilityService;
        private readonly IUserService _userService;

        public FacilitiesController(IFacilityService facilityService, IUserService userService)
        {
            _facilityService = facilityService;
            _userService = userService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(CancellationToken ctoken)
        {
            var result = await _facilityService.GetAllAsync(ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return Ok(result.Value);
        }

        [HttpGet]
        [Route("{identifier}")]
        public async Task<IActionResult> GetByIdentifier([FromRoute] string identifier, CancellationToken ctoken)
        {
            var result = await _facilityService.GetByIdentifierAsync(identifier, ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return Ok(result.Value);
        }

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<FacilityResponse>> Create([FromBody] CreateFacilityRequest request, CancellationToken ctoken)
        {
            var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

            if (userResponse == null)
            {
                return Unauthorized("User not found");
            }

            var result = await _facilityService.CreateFacilityAsync(request.Name, request.FacilityType, request.IsAccessible, request.Longitude, request.Latitude, ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return Ok(result.Value);
        }

        [Authorize]
        [HttpPut]
        [Route("update/{identifier}")]
        public async Task<ActionResult<FacilityResponse>> Update(
            [FromRoute] string identifier,
            [FromBody] UpdateFacilityRequest request, CancellationToken ctoken)
        {
            var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

            if (userResponse == null)
            {
                return Unauthorized("User not found");
            }

            var result = await _facilityService.UpdateFacilityAsync(identifier, request.Name, request.FacilityType, request.IsAccessible, request.Longitude, request.Latitude, ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return Ok(result.Value);
        }

        [Authorize]
        [HttpDelete("{identifier}")]
        public async Task<ActionResult> Delete(string identifier, CancellationToken ctoken)
        {
            var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

            if (userResponse == null)
            {
                return Unauthorized("User not found");
            }

            var result = await _facilityService.DeleteAsync(identifier, ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return NoContent();
        }

        [Authorize]
        [HttpPost("{identifier}/images")]
        public async Task<ActionResult<IReadOnlyCollection<FacilityImageResponse>>> AddFacilityImages(
            string identifier,
            [FromForm] IFormFileCollection images,
            [FromForm] ImageProcessingOptionsRequest options,
            CancellationToken ctoken)
        {
            var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

            if (userResponse == null)
            {
                return Unauthorized("User not found");
            }

            var result = await _facilityService.AddFacilityImagesAsync(identifier, images, options.ToOptions(), ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return Ok(result.Value);
        }

        [Authorize]
        [HttpDelete("images/{imageIdentifier}")]
        public async Task<ActionResult> DeleteFacilityImage(string imageIdentifier, CancellationToken ctoken)
        {
            var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

            if (userResponse == null)
            {
                return Unauthorized("User not found");
            }

            var result = await _facilityService.DeleteFacilityImageAsync(imageIdentifier, ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return NoContent();
        }
    }
}
