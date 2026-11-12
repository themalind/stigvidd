// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Municipality;

namespace Core.Factories.Municipalities;

public class MunicipalityResponseFactory
{
    public MunicipalityResponse Create(Municipality municipality)
    {
        return new MunicipalityResponse
        {
            Identifier = municipality.Identifier,
            Name = municipality.Name,
            Slug = municipality.Slug,
        };
    }
}
