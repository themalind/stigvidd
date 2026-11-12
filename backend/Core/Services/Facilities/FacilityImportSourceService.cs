// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Services.Facilities;

public class FacilityImportSourceService : IFacilityImportSourceService
{
    private readonly IFacilityImportSourceRepository _sourceRepository;
    private readonly IMunicipalityRepository _municipalityRepository;
    private readonly FacilityImportSourceResponseFactory _responseFactory;

    public FacilityImportSourceService(
        IFacilityImportSourceRepository sourceRepository,
        IMunicipalityRepository municipalityRepository,
        FacilityImportSourceResponseFactory responseFactory)
    {
        _sourceRepository = sourceRepository;
        _municipalityRepository = municipalityRepository;
        _responseFactory = responseFactory;
    }

    public async Task<Result<IReadOnlyCollection<FacilityImportSourceResponse>>> GetAllAsync(CancellationToken ctoken)
    {
        var result = await _sourceRepository.GetAllAsync(ctoken);

        if (!result.IsSuccess || result.Value is not { } sources)
            return Result.Fail<IReadOnlyCollection<FacilityImportSourceResponse>>(new Message(500, "Could not read the data sources."));

        return Result.Ok<IReadOnlyCollection<FacilityImportSourceResponse>>(sources.Select(_responseFactory.Create).ToList());
    }

    public async Task<Result<FacilityImportSourceResponse>> CreateAsync(CreateFacilityImportSourceRequest request, CancellationToken ctoken)
    {
        var municipality = await _municipalityRepository.GetByIdentifierAsync(request.MunicipalityIdentifier, ctoken);

        if (municipality.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<FacilityImportSourceResponse>(new Message(400, "Choose a municipality from the list."));

        if (!municipality.IsSuccess || municipality.Value is not { } found)
            return Result.Fail<FacilityImportSourceResponse>(new Message(500, "Could not read the municipality."));

        var name = request.Name.Trim();
        var slug = Slug.From(name);
        var source = new FacilityImportSource
        {
            MunicipalityId = found.Id,
            Name = name,
            Slug = slug,
            // keep-comment: a slug has no colon, so two municipalities' keys can never coincide
            Key = $"{found.Slug}:{slug}",
        };

        var result = await _sourceRepository.CreateAsync(source, ctoken);

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<FacilityImportSourceResponse>(new Message(409, $"{found.Name} already has a data source called {name}, or one whose name differs only in case or punctuation."));

        if (!result.IsSuccess || result.Value is not { } created)
            return Result.Fail<FacilityImportSourceResponse>(new Message(500, "Could not add the data source."));

        created.Municipality = found;

        return Result.Ok(_responseFactory.Create(created));
    }
}
