using Core.Interfaces.Services;
using Microsoft.AspNetCore.Mvc;

namespace StigviddAPI.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class CityAreasController : StigViddController
    {
        private readonly ICityAreaService _cityAreaService;

        public CityAreasController(ICityAreaService cityAreaService)
        {
            _cityAreaService = cityAreaService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(CancellationToken ctoken)
        {
            var result = await _cityAreaService.GetAllAsync(ctoken);

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
            var result = await _cityAreaService.GetByIdentifierAsync(identifier, ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return Ok(result.Value);
        }
    }
}
