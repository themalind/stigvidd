// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Services.Facilities;

public class FacilityImportService : IFacilityImportService
{
    private readonly IFacilityRepository _facilityRepository;
    private readonly IFacilityImportSourceRepository _sourceRepository;
    private readonly FacilityImportResponseFactory _responseFactory;
    private readonly ILogger<FacilityImportService> _logger;
    private readonly ICityAreaMembershipService _cityAreaMembership;

    public FacilityImportService(
        IFacilityRepository facilityRepository,
        IFacilityImportSourceRepository sourceRepository,
        FacilityImportResponseFactory responseFactory,
        ILogger<FacilityImportService> logger,
        ICityAreaMembershipService cityAreaMembership)
    {
        _facilityRepository = facilityRepository;
        _cityAreaMembership = cityAreaMembership;
        _sourceRepository = sourceRepository;
        _responseFactory = responseFactory;
        _logger = logger;
    }

    public async Task<Result<FacilityImportPreviewResponse>> PreviewAsync(FacilityImportRequest request, CancellationToken ctoken)
    {
        var planned = await PlanAsync(request, ctoken);

        if (!planned.Success || planned.Value is not { } import)
            return Result.Fail<FacilityImportPreviewResponse>(planned.Message ?? new Message(500, "Could not plan the import."));

        var plan = import.Plan;

        return Result.Ok(_responseFactory.CreatePreview(import.Source.Key, plan.Rows, plan.UnlinkedFacilities, plan.HasWork, import.Notes));
    }

    public async Task<Result<FacilityImportApplyResponse>> ApplyAsync(FacilityImportRequest request, CancellationToken ctoken)
    {
        var planned = await PlanAsync(request, ctoken);

        if (!planned.Success || planned.Value is not { } import)
            return Result.Fail<FacilityImportApplyResponse>(planned.Message ?? new Message(500, "Could not plan the import."));

        var plan = import.Plan;
        var result = await _facilityRepository.ApplyImportAsync(
            import.Source.Id, import.Mapping.ToJson(), plan.Creates, plan.Updates, ctoken);

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<FacilityImportApplyResponse>(new Message(409, "The facilities changed while the import ran. Preview it again."));

        if (!result.IsSuccess)
            return Result.Fail<FacilityImportApplyResponse>(new Message(500, "Could not apply the import."));

        var changedIds = plan.Creates.Concat(plan.Updates).Select(f => f.Id).ToList();
        await _cityAreaMembership.FacilitiesMovedAsync(changedIds, ctoken);

        var counts = plan.Counts;
        _logger.LogInformation(
            "FacilityImportService: ApplyAsync -> {Source}: {Created} created, {Linked} linked, {Updated} updated, {Unchanged} unchanged, {Missing} missing.",
            import.Source.Key, counts.Created, counts.Linked, counts.Updated, counts.Unchanged, counts.Missing);

        return Result.Ok(_responseFactory.CreateApplied(counts));
    }

    private async Task<Result<PlannedFacilityImport>> PlanAsync(FacilityImportRequest request, CancellationToken ctoken)
    {
        var sourceResult = await _sourceRepository.GetByIdentifierAsync(request.SourceIdentifier, ctoken);

        if (sourceResult.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<PlannedFacilityImport>(new Message(400, "Choose a data source from the list."));

        if (!sourceResult.IsSuccess || sourceResult.Value is not { } source)
            return Result.Fail<PlannedFacilityImport>(new Message(500, "Could not read the data source."));

        var mapping = ToMapping(request.Mapping);
        var read = FacilityFileReader.Read(request.GeoJson, source.Key, mapping);

        if (!read.Success || read.Value is not { } file)
            return Result.Fail<PlannedFacilityImport>(read.Message ?? new Message(400, "The file could not be read."));

        var sites = file.Sites;
        var types = sites.Aggregate(FacilityType.None, (all, site) => all | site.Type);
        var candidates = await _facilityRepository.GetImportCandidatesAsync(source.Key, types, ctoken);

        if (!candidates.IsSuccess || candidates.Value is not { } facilities)
            return Result.Fail<PlannedFacilityImport>(new Message(500, "Could not read the facilities."));

        if (IdFieldChanged(source, mapping, facilities) is { } refusal)
            return Result.Fail<PlannedFacilityImport>(refusal);

        var links = request.Links.Select(l => new FacilityImportLink(l.SourceId, l.FacilityIdentifier)).ToList();
        var kept = request.Kept.Select(k => new FacilityImportKeep(k.SourceId, k.Field)).ToList();
        var plan = FacilityImportPlanner.Plan(source.Key, sites, facilities, links, kept, matchOnPosition: mapping.IdField is null);

        if (!plan.Success || plan.Value is not { } value)
            return Result.Fail<PlannedFacilityImport>(plan.Message ?? new Message(500, "Could not plan the import."));

        return Result.Ok(new PlannedFacilityImport(source, mapping, value, file.Notes));
    }

    // keep-comment: the id makes each facility's SourceId, so another id field would turn every facility into a new one
    private static Message? IdFieldChanged(FacilityImportSource source, FacilityImportMapping mapping, IReadOnlyCollection<Facility> facilities)
    {
        if (FacilityImportMapping.Parse(source.Mapping) is not { } saved || saved.IdField == mapping.IdField)
            return null;

        var prefix = source.Key + ":";

        if (!facilities.Any(f => f.SourceId?.StartsWith(prefix, StringComparison.Ordinal) == true))
            return null;

        var earlier = saved.IdField is { } idField ? $"by {idField}" : "on position";

        return new Message(400, $"{source.Name} has facilities matched {earlier}. Keep that, or every facility would be imported again as new.");
    }

    private static FacilityImportMapping ToMapping(FacilityImportMappingRequest request)
    {
        return new FacilityImportMapping(
            IdField: Field(request.IdField),
            NameField: request.NameField.Trim(),
            DescriptionField: Field(request.DescriptionField),
            UrlField: Field(request.UrlField),
            TypeField: Field(request.TypeField),
            FixedType: (FacilityType)request.FixedType,
            TypeValues: request.TypeValues
                .GroupBy(v => v.Value, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => (FacilityType)g.Last().FacilityType, StringComparer.Ordinal));
    }

    private static string? Field(string? name)
    {
        return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
    }
}
