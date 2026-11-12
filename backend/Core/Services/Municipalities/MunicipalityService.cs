// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using WebDataContracts.RequestModels.Municipality;
using WebDataContracts.ResponseModels.Municipality;

namespace Core.Services.Municipalities;

public class MunicipalityService : IMunicipalityService
{
    private readonly IMunicipalityRepository _municipalityRepository;
    private readonly MunicipalityResponseFactory _responseFactory;

    public MunicipalityService(IMunicipalityRepository municipalityRepository, MunicipalityResponseFactory responseFactory)
    {
        _municipalityRepository = municipalityRepository;
        _responseFactory = responseFactory;
    }

    public async Task<Result<IReadOnlyCollection<MunicipalityResponse>>> GetAllAsync(CancellationToken ctoken)
    {
        var result = await _municipalityRepository.GetAllAsync(ctoken);

        if (!result.IsSuccess || result.Value is not { } municipalities)
            return Result.Fail<IReadOnlyCollection<MunicipalityResponse>>(new Message(500, "Could not read the municipalities."));

        return Result.Ok<IReadOnlyCollection<MunicipalityResponse>>(municipalities.Select(_responseFactory.Create).ToList());
    }

    public async Task<Result<MunicipalityResponse>> CreateAsync(CreateMunicipalityRequest request, CancellationToken ctoken)
    {
        var name = request.Name.Trim();
        var municipality = new Municipality { Name = name, Slug = Slug.From(name) };

        var result = await _municipalityRepository.CreateAsync(municipality, ctoken);

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<MunicipalityResponse>(new Message(409, $"{name} already exists."));

        if (!result.IsSuccess || result.Value is not { } created)
            return Result.Fail<MunicipalityResponse>(new Message(500, "Could not add the municipality."));

        return Result.Ok(_responseFactory.Create(created));
    }
}
