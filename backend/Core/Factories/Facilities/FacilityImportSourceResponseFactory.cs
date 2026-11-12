// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Factories.Facilities;

public class FacilityImportSourceResponseFactory
{
    public FacilityImportSourceResponse Create(FacilityImportSource source)
    {
        return new FacilityImportSourceResponse
        {
            Identifier = source.Identifier,
            Name = source.Name,
            Key = source.Key,
            MunicipalityIdentifier = source.Municipality?.Identifier ?? "",
            MunicipalityName = source.Municipality?.Name ?? "",
            Mapping = FacilityImportMapping.Parse(source.Mapping) is { } mapping ? CreateMapping(mapping) : null,
        };
    }

    private static FacilityImportMappingResponse CreateMapping(FacilityImportMapping mapping)
    {
        return new FacilityImportMappingResponse
        {
            IdField = mapping.IdField,
            NameField = mapping.NameField,
            DescriptionField = mapping.DescriptionField,
            UrlField = mapping.UrlField,
            TypeField = mapping.TypeField,
            FixedType = (int)mapping.FixedType,
            TypeValues = mapping.TypeValues
                .Select(pair => new FacilityImportTypeValueResponse { Value = pair.Key, FacilityType = (int)pair.Value })
                .ToList(),
        };
    }
}
