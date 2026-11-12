// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.CityArea;

public class SetCityAreaMunicipalityRequest
{
    // keep-comment: null clears the area's municipality
    public string? MunicipalityIdentifier { get; set; }
}
