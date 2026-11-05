// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.ResponseModels.Facility;

namespace StigviddAPI.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class FacilitiesController : StigViddController
    {
        private readonly IFacilityService _facilityService;

        public FacilitiesController(IFacilityService facilityService)
        {
            _facilityService = facilityService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<ActionResult<IReadOnlyCollection<FacilityResponse>>> GetAll(CancellationToken ctoken)
        {
            var result = await _facilityService.GetAllAsync(ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return Ok(result.Value);
        }

        [AllowAnonymous]
        [HttpGet]
        [Route("{identifier}")]
        public async Task<ActionResult<FacilityResponse>> GetByIdentifier([FromRoute] string identifier, CancellationToken ctoken)
        {
            var result = await _facilityService.GetByIdentifierAsync(identifier, ctoken);

            if (!result.Success && result.Message != null)
            {
                return ToActionResult(result.Message);
            }

            return Ok(result.Value);
        }
    }
}
